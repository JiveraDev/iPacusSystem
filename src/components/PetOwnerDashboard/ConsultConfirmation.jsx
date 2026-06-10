import { useState } from "react";
import { useNavigate, useParams } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { CheckCircle, Calendar, Clock, Video, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { formatDisplayDate, formatDisplayDateTime, formatDisplayTime } from "../../lib/date";
import { toast } from "../../reusecomponent/toast.jsx";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { fetchBookingById, updateBookingStatus } from "../../services/bookingService";
import { fetchOnlineConsultations, joinOnlineConsultation } from "../../services/onlineConsultationService";

const DEBUG_ALLOW_JOIN_OUTSIDE_SCHEDULE = true;

export default function ConsultConfirmation() {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const [consultation, setConsultation] = useState(null);
  const [onlineConsultation, setOnlineConsultation] = useState(null);
  const [canJoin, setCanJoin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellationData, setCancellationData] = useState({
    message: "",
    walletNumber: "",
    transactionNumber: ""
  });

  const fetchConsultation = async () => {
    try {
      const data = await fetchBookingById(bookingId, { apiPrefix: true });
      // get_bookings returns an array
      const consult = data.find(b => b.id.toString() === bookingId.toString());

      if (consult) {
        setConsultation(consult);
        if (!cancelDialogOpen) {
          const senderNumberMatch = String(consult.notes || "").match(/\[Sender Number:\s*(.*?)\]/i);
          setCancellationData((current) => ({
            ...current,
            walletNumber: senderNumberMatch?.[1] || ""
          }));
        }
        const onlineData = await fetchOnlineConsultations({ bookingId: consult.id }).catch(() => []);
        const online = Array.isArray(onlineData) ? onlineData[0] : null;
        setOnlineConsultation(online || null);

        const scheduledStart = online?.scheduledStart
          ? new Date(String(online.scheduledStart).replace(" ", "T"))
          : new Date(`${consult.date} ${consult.time}`);
        const scheduledEnd = online?.scheduledEnd
          ? new Date(String(online.scheduledEnd).replace(" ", "T"))
          : new Date(scheduledStart.getTime() + 60 * 60000);
        const tenMinutesBefore = new Date(scheduledStart.getTime() - 10 * 60000);
        const now = new Date();
        const vetHasStarted = ["vet_ready", "in_progress"].includes(String(online?.status || ""));
        const withinScheduledJoinWindow = now >= tenMinutesBefore && now <= scheduledEnd;

        setCanJoin(
          consult.status === "confirmed" &&
          Boolean(online?.meetingUrl) &&
          vetHasStarted &&
          (DEBUG_ALLOW_JOIN_OUTSIDE_SCHEDULE || withinScheduledJoinWindow)
        );
      }
    } catch (error) {
      console.error("Error fetching consultation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useAutoRefresh(fetchConsultation, {
    enabled: Boolean(bookingId),
    refreshKey: bookingId
  });

  const handleJoinConsultation = async () => {
    if (!onlineConsultation?.meetingUrl) {
      toast.error("The consultation room is not available yet.");
      return;
    }

    if (!canJoin) {
      toast.error("Please wait for the veterinarian to start the consultation.");
      return;
    }

    try {
      const data = await joinOnlineConsultation(onlineConsultation.id);
      if (data) {
        setOnlineConsultation(data);
      }
      navigate(`/dashboard/consult/video/${onlineConsultation.id}`);
    } catch (error) {
      console.error("Join consultation failed:", error);
      toast.error(error.message || "Failed to join consultation");
    }
  };

  const openCancelDialog = () => {
    setCancelDialogOpen(true);
  };

  const confirmCancellation = async () => {
    if (!consultation) return;

    if (!cancellationData.message.trim()) {
      toast.error("Please enter a cancellation message.");
      return;
    }

    setIsCancelling(true);
    try {
      await updateBookingStatus(consultation.id, {
        status: "cancelled",
        cancellation_message: cancellationData.message.trim(),
        wallet_number: cancellationData.walletNumber.trim(),
        transaction_number: cancellationData.transactionNumber.trim()
      });

      toast.success("Cancellation request sent to admin.");
      setCancelDialogOpen(false);
      setConsultation((current) => current ? { ...current, status: "cancelled" } : current);
    } catch (error) {
      console.error("Cancellation request failed:", error);
      toast.error(error.message || "Failed to request cancellation");
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#155dfc] border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500">Loading details...</p>
        </div>
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Consultation Not Found</h1>
            <p className="mt-2 text-gray-600">The consultation booking could not be loaded.</p>
            <Button onClick={() => navigate("/dashboard/consult")} className="mt-6">
              Back to Consultations
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const consultDateTime = onlineConsultation?.scheduledStart
    ? new Date(String(onlineConsultation.scheduledStart).replace(" ", "T"))
    : new Date(`${consultation.date} ${consultation.time}`);
  const consultEndDateTime = onlineConsultation?.scheduledEnd
    ? new Date(String(onlineConsultation.scheduledEnd).replace(" ", "T"))
    : new Date(consultDateTime.getTime() + 60 * 60000);
  const isPast = consultation.status === "completed" || (
    !DEBUG_ALLOW_JOIN_OUTSIDE_SCHEDULE && new Date() > consultEndDateTime
  );
  const vetHasStarted = ["vet_ready", "in_progress"].includes(String(onlineConsultation?.status || ""));
  const statusTitle =
    consultation.status === 'confirmed'
      ? 'Consultation Confirmed!'
      : consultation.status === 'cancelled'
        ? 'Consultation Cancelled'
        : 'Consultation Pending Review';
  const statusMeta =
    consultation.status === 'confirmed'
      ? {
          icon: CheckCircle,
          ring: 'bg-green-100',
          iconColor: 'text-green-600',
          titleColor: 'text-gray-900'
        }
      : consultation.status === 'cancelled'
        ? {
            icon: XCircle,
            ring: 'bg-red-100',
            iconColor: 'text-red-600',
            titleColor: 'text-gray-900'
          }
        : {
            icon: AlertCircle,
            ring: 'bg-amber-100',
            iconColor: 'text-amber-600',
            titleColor: 'text-gray-900'
          };
  const StatusIcon = statusMeta.icon;

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="text-center">
        <div className={`inline-flex items-center justify-center w-16 h-16 ${statusMeta.ring} rounded-full mb-4`}>
          <StatusIcon className={`h-10 w-10 ${statusMeta.iconColor}`} />
        </div>
        <h1 className={`text-3xl font-bold ${statusMeta.titleColor}`}>{statusTitle}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consultation Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Booking ID</p>
              <p className="font-semibold">{consultation.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <span className={`inline-block px-3 py-1 text-sm rounded-full ${
                consultation.status === 'confirmed' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {consultation.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Pet</p>
                <p className="font-semibold text-lg">{consultation.petName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Discussion Topics</p>
                <p className="font-semibold">{consultation.service || consultation.discussionTopic}</p>
              </div>
              {consultation.notes && (
                <div>
                  <p className="text-sm text-gray-600">Additional Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{consultation.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-blue-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="font-semibold">{formatDisplayDate(consultDateTime)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-blue-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Time</p>
                  <p className="font-semibold">{formatDisplayTime(consultation.time)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div>
              <p className="text-sm text-gray-600">Veterinarian</p>
              <p className="font-semibold text-lg">{consultation.veterinarian}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Payment Status</span>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                PAID
              </span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-gray-600">Amount Paid</span>
              <span className="font-semibold text-lg">PHP 500</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isPast && consultation.status !== "cancelled" && (
        <Card className={canJoin ? "border-green-300 bg-green-50" : "border-blue-300 bg-blue-50"}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center ${
                canJoin ? 'bg-green-200' : 'bg-blue-200'
              }`}>
                <Video className={`h-6 w-6 ${canJoin ? 'text-green-700' : 'text-blue-700'}`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">
                  {canJoin ? "Join Your Consultation" : "Consultation Room"}
                </h3>
                <p className="text-gray-700 mb-4">
                  {canJoin
                    ? "Your veterinarian has started the consultation. Click below to join the Jitsi room."
                    : consultation.status !== "confirmed"
                      ? "The Jitsi room will be created after admin approval."
                      : !onlineConsultation?.meetingUrl
                        ? "The consultation room is not available yet."
                        : !vetHasStarted
                          ? "Waiting for the veterinarian to start the consultation."
                          : "The join button will become active 10 minutes before your scheduled time."}
                </p>
                <Button 
                  onClick={handleJoinConsultation}
                  disabled={!canJoin}
                  className="gap-2"
                  size="lg"
                >
                  <Video className="h-5 w-5" />
                  {canJoin ? "Join Consultation Now" : "Join Consultation"}
                </Button>
                {!canJoin && consultation.status === "confirmed" && onlineConsultation?.meetingUrl && (
                  <p className="text-sm text-gray-600 mt-2">
                    {vetHasStarted
                      ? `Available from: ${formatDisplayDateTime(new Date(consultDateTime.getTime() - 10 * 60000))}`
                      : "The vet must start the session before you can join."}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {consultation.status !== "cancelled" && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-lg text-gray-900">Need to cancel this consultation?</h3>
                <p className="text-sm text-gray-600">
                  Send a cancellation request to admin. If a refund or return is needed, include the wallet number and transaction number.
                </p>
              </div>
              <Button variant="destructive" onClick={openCancelDialog}>
                <XCircle className="h-4 w-4 mr-2" />
                Request Cancellation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isPast && (
        <Card className="border-gray-300 bg-gray-50">
          <CardContent className="pt-6 text-center">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="font-semibold text-lg mb-2">Consultation Completed</h3>
            <p className="text-gray-600">This consultation has already taken place.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>What to Prepare</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-gray-700">
            <li className="flex gap-2">
              <span className="text-blue-600">•</span>
              <span>Ensure you have a stable internet connection</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600">•</span>
              <span>Have your pet nearby during the consultation</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600">•</span>
              <span>Prepare any medical records or documents you want to discuss</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600">•</span>
              <span>Be in a quiet, well-lit area for the video call</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button variant="outline" onClick={() => navigate("/dashboard/consult")} className="flex-1">
          Back to Consultations
        </Button>
        <Button onClick={() => navigate("/dashboard")} className="flex-1">
          Go to Dashboard
        </Button>
      </div>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-['Arimo:Bold',sans-serif] text-[24px]">
              Request Cancellation
            </DialogTitle>
            <DialogDescription className="font-['Arimo:Regular',sans-serif] text-[14px]">
              Send the cancellation request to admin. The request will be stored with this booking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-gray-600">Booking Number</p>
                <p className="font-semibold">{consultation.bookingNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Current Status</p>
                <p className="font-semibold uppercase">{consultation.status}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Cancellation Message *</label>
              <Textarea
                value={cancellationData.message}
                onChange={(event) => setCancellationData({ ...cancellationData, message: event.target.value })}
                placeholder="Explain why you want to cancel this consultation."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">Wallet Number</label>
                <Input
                  value={cancellationData.walletNumber}
                  onChange={(event) => setCancellationData({ ...cancellationData, walletNumber: event.target.value })}
                  placeholder="Wallet number used for payment"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">Transaction Number</label>
                <Input
                  value={cancellationData.transactionNumber}
                  onChange={(event) => setCancellationData({ ...cancellationData, transactionNumber: event.target.value })}
                  placeholder="Transaction reference"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={isCancelling}>
              Close
            </Button>
            <Button variant="destructive" onClick={confirmCancellation} disabled={isCancelling}>
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
