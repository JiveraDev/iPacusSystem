import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Video, Calendar, Clock, Loader2 } from "lucide-react";
import { useState } from "react";
import { formatDisplayDate, formatDisplayTime } from "../../lib/date";
import { toast } from "../../reusecomponent/toast.jsx";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { fetchUserBookings } from "../../services/bookingService";
import { fetchOnlineConsultations, joinOnlineConsultation } from "../../services/onlineConsultationService";
import { useBookingPriceProjections } from "../../hooks/useBookingPriceProjections";

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

function isUpcomingConsultation(consultation) {
  const consultDate = parseConsultDateTime(consultation);
  return Boolean(consultDate && consultDate >= new Date());
}

export default function Consult() {
  const navigate = useNavigate();
  const { config: priceProjectionConfig } = useBookingPriceProjections();
  const { servicePrices } = priceProjectionConfig;
  const [upcomingConsultations, setUpcomingConsultations] = useState([]);
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
    } catch (error) {
      console.error("Error fetching consultations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useAutoRefresh(fetchConsultations);

  const handleJoinConsultation = async (consultation) => {
    setJoiningConsultationId(consultation.id);
    try {
      const data = await fetchOnlineConsultations({ bookingId: consultation.id });
      const onlineConsultation = Array.isArray(data) ? data[0] : data;
      if (!onlineConsultation?.meetingUrl) {
        throw new Error("The consultation room is not available yet.");
      }

      const vetHasStarted = ["vet_ready", "in_progress"].includes(String(onlineConsultation.status || ""));
      if (!vetHasStarted) {
        throw new Error("Please wait for the veterinarian to start the consultation.");
      }

      await joinOnlineConsultation(onlineConsultation.id);

      navigate(`/dashboard/consult/video/${onlineConsultation.id}`);
    } catch (error) {
      console.error("Join consultation failed:", error);
      toast.error(error.message || "Failed to join consultation");
    } finally {
      setJoiningConsultationId(null);
    }
  };

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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Online Consultations</h1>
      </div>

      <Card className="bg-blue-50 border-blue-200">
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
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/dashboard/consult/booking")}>
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

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100">
                <Video className="h-6 w-6 text-green-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-lg">Recent Consultations</h3>
                <p className="text-sm text-gray-600">{upcomingConsultations.length} scheduled</p>
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
              const canJoinConsultation = consultation.status === 'confirmed' && isUpcomingConsultation(consultation);
              const isJoining = joiningConsultationId === consultation.id;

              return (
                <Card key={consultation.id}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{consultation.petName}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            consultation.status === 'confirmed' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {consultation.status}
                          </span>
                        </div>
                        <p className="text-gray-600">Topic: {consultation.service || consultation.discussionTopic}</p>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDisplayDate(consultation.date)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{formatDisplayTime(consultation.time)}</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">Veterinarian: {consultation.veterinarian}</p>
                        
                        {canJoinConsultation && (
                          <div className="pt-2">
                            <Button 
                              variant="outline"
                              size="sm"
                              onClick={() => handleJoinConsultation(consultation)}
                              disabled={isJoining}
                              className="inline-flex items-center gap-2"
                            >
                              {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />}
                              {isJoining ? "Joining..." : "Join Consultation"}
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
