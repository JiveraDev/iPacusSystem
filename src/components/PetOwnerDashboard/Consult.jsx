import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { AlertCircle, Calendar, CheckCircle2, Clock, Loader2, Video, XCircle } from "lucide-react";
import { useState } from "react";
import { formatDisplayDate, formatDisplayTime } from "../../lib/date";
import { toast } from "../../reusecomponent/toast.jsx";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { fetchUserBookings } from "../../services/bookingService";
import { fetchOnlineConsultations } from "../../services/onlineConsultationService";
import { useBookingPriceProjections } from "../../hooks/useBookingPriceProjections";
import { formatDisplayPersonName } from "../../lib/personName";
import DashboardPageHeader from "../shared/DashboardPageHeader.jsx";

function parseConsultDateTime(consultation) {
  if (!consultation?.date) {
    return null;
  }

  const datePart = String(consultation.date).split(" ")[0];
  const timePart = consultation.time ? String(consultation.time) : "00:00:00";
  const consultDate = new Date(`${datePart}T${timePart}`);

  return Number.isNaN(consultDate.getTime()) ? null : consultDate;
}

function parseCreatedAt(consultation) {
  const createdDate = consultation?.createdAt ? new Date(String(consultation.createdAt).replace(" ", "T")) : null;
  return createdDate && !Number.isNaN(createdDate.getTime()) ? createdDate : null;
}

function sortConsultationsNewestFirst(left, right) {
  const leftDate = parseConsultDateTime(left);
  const rightDate = parseConsultDateTime(right);
  const dateDifference = (rightDate?.getTime() || 0) - (leftDate?.getTime() || 0);

  if (dateDifference !== 0) {
    return dateDifference;
  }

  const leftCreatedAt = parseCreatedAt(left);
  const rightCreatedAt = parseCreatedAt(right);
  const createdDifference = (rightCreatedAt?.getTime() || 0) - (leftCreatedAt?.getTime() || 0);

  if (createdDifference !== 0) {
    return createdDifference;
  }

  return Number(right?.id || 0) - Number(left?.id || 0);
}

function isWithinConsultDisplayWindow(consultation) {
  const consultDate = parseConsultDateTime(consultation);
  if (!consultDate) {
    return false;
  }

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  oneMonthAgo.setHours(0, 0, 0, 0);

  return consultDate >= oneMonthAgo;
}

function normalizeConsultationStatus(value) {
  return String(value || "pending").trim().toLowerCase().replace(/[_-]+/g, " ");
}

function normalizeOnlineConsultationStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function isLiveOnlineConsultation(consultation) {
  return ["vet_ready", "in_progress"].includes(normalizeOnlineConsultationStatus(consultation?.status));
}

function consultationStatusMeta(value) {
  const status = normalizeConsultationStatus(value);

  if (status.includes("complete") || status.includes("done")) {
    return {
      label: "Completed",
      icon: CheckCircle2,
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
    };
  }
  if (status.includes("cancel") || status.includes("reject")) {
    return {
      label: status.includes("reject") ? "Rejected" : "Cancelled",
      icon: XCircle,
      badgeClass: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
    };
  }
  if (status.includes("confirm") || status.includes("approve") || status.includes("progress")) {
    return {
      label: status.includes("progress") ? "In progress" : "Confirmed",
      icon: CheckCircle2,
      badgeClass: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
    };
  }

  return {
    label: "Pending review",
    icon: AlertCircle,
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
  };
}

export default function Consult() {
  const navigate = useNavigate();
  const { config: priceProjectionConfig } = useBookingPriceProjections();
  const { servicePrices } = priceProjectionConfig;
  const [upcomingConsultations, setUpcomingConsultations] = useState([]);
  const [onlineConsultationsByBookingId, setOnlineConsultationsByBookingId] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [joiningConsultationId, setJoiningConsultationId] = useState(null);

  const fetchConsultations = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const userId = currentUser.id || currentUser.user_id;

      if (!userId) {
        setIsLoading(false);
        return;
      }

      const data = await fetchUserBookings(userId, { apiPrefix: true });
      const consultations = data.filter(b => b.isOnlineConsultation);

      const upcoming = consultations
        .filter(isWithinConsultDisplayWindow)
        .sort(sortConsultationsNewestFirst);

      setUpcomingConsultations(upcoming);

      try {
        const onlineConsultations = await fetchOnlineConsultations({ ownerId: userId });
        const byBookingId = (Array.isArray(onlineConsultations) ? onlineConsultations : []).reduce((result, item) => {
          if (item?.bookingId) {
            result[String(item.bookingId)] = item;
          }
          return result;
        }, {});
        setOnlineConsultationsByBookingId(byBookingId);
      } catch (onlineConsultationError) {
        console.error("Error fetching live consultation states:", onlineConsultationError);
      }
    } catch (error) {
      console.error("Error fetching consultations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useAutoRefresh(fetchConsultations);

  const handleJoinConsultation = async (consultation, knownOnlineConsultation = null) => {
    setJoiningConsultationId(consultation.id);
    try {
      let onlineConsultation = knownOnlineConsultation;
      if (!onlineConsultation) {
        const data = await fetchOnlineConsultations({ bookingId: consultation.id });
        onlineConsultation = Array.isArray(data) ? data[0] : data;
      }
      if (!onlineConsultation?.meetingUrl) {
        throw new Error("The consultation room is not available yet.");
      }

      const vetHasStarted = ["vet_ready", "in_progress"].includes(String(onlineConsultation.status || ""));
      if (!vetHasStarted) {
        throw new Error("Please wait for the veterinarian to start the consultation.");
      }

      navigate(`/dashboard/consult/video/${onlineConsultation.id}`);
    } catch (error) {
      console.error("Join consultation failed:", error);
      toast.error(error.message || "Failed to join consultation");
    } finally {
      setJoiningConsultationId(null);
    }
  };

  const activeConsultation = upcomingConsultations
    .map((booking) => ({
      booking,
      onlineConsultation: onlineConsultationsByBookingId[String(booking.id)]
    }))
    .find(({ onlineConsultation }) => isLiveOnlineConsultation(onlineConsultation));

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#155dfc] border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500">Loading consultations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DashboardPageHeader
        icon={Video}
        title="Online Consultations"
        description="Book, review, and join your clinic video consultations."
      />

      {activeConsultation && (
        <section
          className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/35 sm:flex-row sm:items-center sm:justify-between"
          aria-label="Active online consultation"
          aria-live="polite"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="relative mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-300">
              <span className="absolute right-0 top-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-50 dark:ring-emerald-950" />
              <Video className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-bold text-emerald-950 dark:text-emerald-100">
                {normalizeOnlineConsultationStatus(activeConsultation.onlineConsultation.status) === "in_progress"
                  ? "Your consultation is ongoing"
                  : "Your veterinarian is in the call"}
              </p>
              <p className="mt-0.5 text-sm text-emerald-800 dark:text-emerald-200">
                Join {activeConsultation.booking.petName || "your pet"}'s private consultation room now.
              </p>
            </div>
          </div>
          <Button
            onClick={() => handleJoinConsultation(activeConsultation.booking, activeConsultation.onlineConsultation)}
            disabled={joiningConsultationId === activeConsultation.booking.id}
            className="shrink-0 gap-2 bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {joiningConsultationId === activeConsultation.booking.id
              ? <Loader2 className="size-4 animate-spin" />
              : <Video className="size-4" />}
            {joiningConsultationId === activeConsultation.booking.id ? "Joining..." : "Join call now"}
          </Button>
        </section>
      )}

      <Card
        petHover="always"
        petKind="parrot"
        petAccent="mint"
        className="overflow-hidden border-blue-200 bg-blue-50"
      >
        <CardHeader>
          <CardTitle>How Online Consultations Work</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-gray-700">
            <p>• Select your pet and describe the consultation topic (weight, symptoms, behavior, etc.)</p>
            <p>• Choose an available time slot (bookings available from next day onwards)</p>
            <p>• Complete secure payment with the clinic payment methods ({servicePrices.onlineConsultation})</p>
            <p>• Join the video consultation at your scheduled time</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card
          petHover="always"
          petKind="dog"
          petAccent="coral"
          className="cursor-pointer overflow-hidden transition-shadow hover:shadow-lg"
          onClick={() => navigate("/dashboard/consult/booking")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-lg">Book New Consultation</h3>
                <p className="text-sm text-gray-600">Schedule an appointment with a veterinarian</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card petHover="always" petKind="cat" petAccent="blue" className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/50">
                <Video className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-lg">Recent Consultations</h3>
                <p className="text-sm text-gray-600 dark:text-slate-300">
                  {upcomingConsultations.length} recent booking{upcomingConsultations.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {upcomingConsultations.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Your Recent Consultations</h2>
          <div className="space-y-4">
            {upcomingConsultations.map((consultation) => {
              const normalizedStatus = normalizeConsultationStatus(consultation.status);
              const status = consultationStatusMeta(normalizedStatus);
              const StatusIcon = status.icon;
              const onlineConsultation = onlineConsultationsByBookingId[String(consultation.id)];
              const onlineStatus = normalizeOnlineConsultationStatus(onlineConsultation?.status);
              // The scheduled time is informational. The server permits the
              // owner to join whenever the veterinarian has opened the room.
              const canJoinConsultation = isLiveOnlineConsultation(onlineConsultation);
              const isJoining = joiningConsultationId === consultation.id;

              return (
                <Card key={consultation.id}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-lg text-slate-950 dark:text-white">{consultation.petName || "Pet name unavailable"}</h3>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${status.badgeClass}`}>
                            <StatusIcon className="size-3.5" aria-hidden="true" />
                            {status.label}
                          </span>
                          {canJoinConsultation && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                              <span className="size-2 rounded-full bg-emerald-500" />
                              {onlineStatus === "in_progress" ? "Call ongoing" : "Veterinarian in call"}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 dark:text-slate-300">Topic: {consultation.discussionTopic || consultation.service || "Not specified"}</p>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-slate-300">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDisplayDate(consultation.date)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{formatDisplayTime(consultation.time)}</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-slate-300">Veterinarian: {formatDisplayPersonName(consultation.veterinarian, "Veterinarian not assigned")}</p>
                        
                        {canJoinConsultation && (
                          <div className="pt-2">
                            <Button 
                              variant="outline"
                              size="sm"
                              onClick={() => handleJoinConsultation(consultation, onlineConsultation)}
                              disabled={isJoining}
                              className="inline-flex items-center gap-2"
                            >
                              {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                              {isJoining ? "Joining..." : "Join call now"}
                            </Button>
                          </div>
                        )}
                      </div>
                      <Button 
                        onClick={() => navigate(`/dashboard/consult/confirmation/${consultation.id}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {upcomingConsultations.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Video className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No Recent Consultations</h3>
            <p className="text-gray-600 mb-4">You don't have any consultations scheduled within the last month.</p>
            <Button onClick={() => navigate("/dashboard/consult/booking")}>
              Book Your First Consultation
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
