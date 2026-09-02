import { useState } from "react";
import { useNavigate, useParams } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { CheckCircle, Calendar, Clock, Video, AlertCircle, XCircle, Loader2, Image as ImageIcon } from "lucide-react";
import { formatDisplayDate, formatDisplayDateTime, formatDisplayTime } from "../../lib/date";
import { formatPhpCurrency } from "../../lib/currency";
import { formatDisplayPersonName } from "../../lib/personName";
import { isValidPhilippinePhone, normalizePhilippinePhoneForSubmit, normalizePhilippinePhoneInput } from "../../lib/philippinePhone";
import { toast } from "../../reusecomponent/toast.jsx";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { fetchBookingById, updateBookingStatus } from "../../services/bookingService";
import { fetchOnlineConsultations, joinOnlineConsultation } from "../../services/onlineConsultationService";
import { useBookingPriceProjections } from "../../hooks/useBookingPriceProjections";
import ProtectedImage from "../shared/ProtectedImage.jsx";
import { PhotoViewer } from "../../ui/photo-viewer";
import { readOnlineConsultationSubmission } from "../../lib/onlineConsultationSubmission";
import { isValidTransactionNumber, normalizeTransactionNumber, TRANSACTION_NUMBER_LENGTH, TRANSACTION_NUMBER_MESSAGE } from "../../lib/transactionNumber";
import DashboardPageHeader from "../shared/DashboardPageHeader.jsx";

function normalizeConsultationStatus(value) {
  return String(value || "pending").trim().toLowerCase().replace(/[_-]+/g, " ");
}

function consultationStatusPresentation(status) {
  if (status === "completed") {
    return {
      title: "Consultation completed",
      label: "Completed",
      icon: CheckCircle,
      ring: "bg-emerald-100 dark:bg-emerald-950/50",
      iconColor: "text-emerald-600 dark:text-emerald-300",
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
    };
  }
  if (status === "confirmed") {
    return {
      title: "Consultation confirmed",
      label: "Confirmed",
      icon: CheckCircle,
      ring: "bg-blue-100 dark:bg-blue-950/50",
      iconColor: "text-blue-600 dark:text-blue-300",
      badge: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300"
    };
  }
  if (status === "cancelled" || status === "rejected") {
    return {
      title: status === "rejected" ? "Consultation rejected" : "Consultation cancelled",
      label: status === "rejected" ? "Rejected" : "Cancelled",
      icon: XCircle,
      ring: "bg-red-100 dark:bg-red-950/50",
      iconColor: "text-red-600 dark:text-red-300",
      badge: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
    };
  }

  return {
    title: "Consultation pending review",
    label: "Pending review",
    icon: AlertCircle,
    ring: "bg-amber-100 dark:bg-amber-950/50",
    iconColor: "text-amber-600 dark:text-amber-300",
    badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
  };
}

function formatClinicalValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) {
    return value.map(formatClinicalValue).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => {
        const label = key.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
        const detail = formatClinicalValue(item);
        return detail ? `${label}: ${detail}` : "";
      })
      .filter(Boolean)
      .join(" • ");
  }

  return String(value).trim();
}

export default function ConsultConfirmation() {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const { config: priceProjectionConfig } = useBookingPriceProjections();
  const { servicePrices } = priceProjectionConfig;
  const [submissionReceipt] = useState(() => readOnlineConsultationSubmission(bookingId));
  const [consultation, setConsultation] = useState(null);
  const [onlineConsultation, setOnlineConsultation] = useState(null);
  const [canJoin, setCanJoin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancellationData, setCancellationData] = useState({
    message: "",
    walletNumber: normalizePhilippinePhoneInput(""),
    transactionNumber: ""
  });

  const fetchConsultation = async () => {
    if (!/^\d+$/.test(String(bookingId || ""))) {
      setIsLoading(false);
      return;
    }

    try {
      const data = await fetchBookingById(bookingId, { apiPrefix: true });
      const bookings = Array.isArray(data)
        ? data
        : Array.isArray(data?.bookings)
          ? data.bookings
          : data
            ? [data]
            : [];
      const consult = bookings.find((item) => String(item?.id || item?.booking_id || "") === String(bookingId));

      if (consult) {
        setConsultation(consult);
        if (!cancelDialogOpen) {
          const senderNumberMatch = String(consult.notes || "").match(/\[Sender Number:\s*(.*?)\]/i);
          setCancellationData((current) => ({
            ...current,
            walletNumber: normalizePhilippinePhoneInput(consult.paymentSenderNumber || senderNumberMatch?.[1] || "")
          }));
        }
        const onlineData = await fetchOnlineConsultations({ bookingId: consult.id }).catch(() => []);
        const online = Array.isArray(onlineData) ? onlineData[0] : null;
        setOnlineConsultation(online || null);

        const vetHasStarted = ["vet_ready", "in_progress"].includes(String(online?.status || ""));

        setCanJoin(
          normalizeConsultationStatus(consult.status) === "confirmed" &&
          Boolean(online?.meetingUrl) &&
          vetHasStarted
        );
      } else {
        setConsultation(null);
      }
    } catch (error) {
      console.error("Error fetching consultation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useAutoRefresh(fetchConsultation, {
    enabled: /^\d+$/.test(String(bookingId || "")),
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

    const walletNumber = normalizePhilippinePhoneForSubmit(cancellationData.walletNumber, { optional: true });
    if (!isValidPhilippinePhone(cancellationData.walletNumber, { optional: true })) {
      toast.error("Wallet number must be complete after +639.");
      return;
    }
    if (cancellationData.transactionNumber.trim() && !isValidTransactionNumber(cancellationData.transactionNumber)) {
      toast.error(TRANSACTION_NUMBER_MESSAGE);
      return;
    }

    setIsCancelling(true);
    try {
      await updateBookingStatus(consultation.id, {
        status: "cancelled",
        cancellation_message: cancellationData.message.trim(),
        wallet_number: walletNumber,
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
    if (submissionReceipt) {
      return (
        <div className="mx-auto max-w-3xl space-y-6">
          <Card petHover="always" petKind="dog" petAccent="mint" petPosition="top-right" className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="py-10 text-center sm:py-12">
              <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle className="size-9" aria-hidden="true" />
              </span>
              <h1 className="mt-5 text-2xl font-bold text-slate-950 sm:text-3xl">Consultation Submitted!</h1>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Your booking and payment details were saved successfully. The clinic will review the payment and confirm your schedule.
              </p>

              <dl className="mx-auto mt-7 grid max-w-xl gap-3 text-left sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-100 bg-white px-4 py-3">
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Booking</dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {submissionReceipt.bookingNumber || (submissionReceipt.bookingId ? `Booking #${submissionReceipt.bookingId}` : 'Successfully registered')}
                  </dd>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-white px-4 py-3">
                  <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Status</dt>
                  <dd className="mt-1 font-semibold text-amber-700">Pending clinic review</dd>
                </div>
                {submissionReceipt.petName && (
                  <div className="rounded-lg border border-emerald-100 bg-white px-4 py-3">
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Pet</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{submissionReceipt.petName}</dd>
                  </div>
                )}
                {(submissionReceipt.bookingDate || submissionReceipt.bookingTime) && (
                  <div className="rounded-lg border border-emerald-100 bg-white px-4 py-3">
                    <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Requested schedule</dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {[submissionReceipt.bookingDate, submissionReceipt.bookingTime].filter(Boolean).join(' at ')}
                    </dd>
                  </div>
                )}
              </dl>

              <p className="mx-auto mt-5 max-w-xl text-xs font-medium leading-5 text-slate-500">
                Confirmation details will refresh automatically as soon as the booking lookup is available.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Button variant="outline" onClick={() => navigate("/dashboard/consult")}>View Consultations</Button>
                <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Card petHover="always" petKind="cat" petAccent="coral" petPosition="top-right">
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
  const bookingStatus = normalizeConsultationStatus(consultation.status);
  const onlineStatus = normalizeConsultationStatus(onlineConsultation?.status || "");
  const resolvedStatus = bookingStatus === "completed" || onlineStatus === "completed"
    ? "completed"
    : bookingStatus;
  const isCompleted = resolvedStatus === "completed";
  const isCancelled = resolvedStatus === "cancelled" || resolvedStatus === "rejected";
  const isScheduledTimePast = new Date() > consultEndDateTime;
  const vetHasStarted = ["vet ready", "in progress"].includes(onlineStatus);
  const showJoinCard = !isCompleted && !isCancelled && (!isScheduledTimePast || vetHasStarted);
  const statusMeta = consultationStatusPresentation(resolvedStatus);
  const StatusIcon = statusMeta.icon;
  const discussionTopic = onlineConsultation?.discussionTopic
    || consultation.discussionTopic
    || consultation.service
    || "Not specified";
  const additionalNotes = onlineConsultation?.notes || consultation.notes || "";
  const veterinarianName = formatDisplayPersonName(
    onlineConsultation?.veterinarianName || consultation.veterinarian,
    "Veterinarian not assigned"
  );
  const paymentAmount = Number(consultation.price || 0) > 0
    ? formatPhpCurrency(consultation.price)
    : servicePrices.onlineConsultation;
  const hasPaymentProof = Boolean(consultation.paymentProof);
  const paymentStatus = isCompleted || resolvedStatus === "confirmed"
    ? "Verified"
    : isCancelled && hasPaymentProof
      ? "Cancellation or refund review"
      : hasPaymentProof
        ? "Submitted for review"
        : "No payment recorded";
  const clinicalDetails = [
    ["Diagnosis", onlineConsultation?.diagnosis],
    ["Recommendations", onlineConsultation?.recommendations],
    ["Treatment", onlineConsultation?.treatment],
    ["Medications", onlineConsultation?.medications],
    ["Veterinarian notes", onlineConsultation?.diagnosisNotes],
    ["Vital signs", onlineConsultation?.vitalSigns],
    ["Symptoms", onlineConsultation?.symptoms],
    ["Laboratory tests", onlineConsultation?.labTests]
  ]
    .map(([label, value]) => [label, formatClinicalValue(value)])
    .filter(([, value]) => Boolean(value));
  const concernImages = Array.isArray(onlineConsultation?.concernImages)
    ? onlineConsultation.concernImages
    : String(consultation.image_Booking_Concern_Path || '')
        .split(',')
        .map((path) => path.trim())
        .filter(Boolean);

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <DashboardPageHeader
        icon={StatusIcon}
        title={statusMeta.title}
        description="Review the latest appointment, payment, and consultation status."
      />

      <Card>
        <CardHeader>
          <CardTitle>Consultation Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Booking Number</p>
              <p className="font-semibold">{consultation.bookingNumber || `Booking #${consultation.id}`}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-slate-300">Status</p>
              <span className={`mt-1 inline-flex rounded-full border px-3 py-1 text-sm font-bold ${statusMeta.badge}`}>
                {statusMeta.label}
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
                <p className="text-sm text-gray-600 dark:text-slate-300">Discussion topics</p>
                <p className="font-semibold text-slate-950 dark:text-white">{discussionTopic}</p>
              </div>
              {additionalNotes && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-slate-300">Additional notes</p>
                  <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">{additionalNotes}</p>
                </div>
              )}
              {concernImages.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm text-gray-600">
                    <ImageIcon className="h-4 w-4" />
                    <span>Concern Images</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {concernImages.map((path, index) => (
                      <button
                        key={`${path}-${index}`}
                        type="button"
                        onClick={() => setViewerImage({ src: path, alt: `Concern image ${index + 1}` })}
                        className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#155dfc]"
                        aria-label={`View concern image ${index + 1}`}
                      >
                        <ProtectedImage
                          src={path}
                          alt={`Concern image ${index + 1}`}
                          className="aspect-square w-full object-cover transition-transform hover:scale-105"
                        />
                      </button>
                    ))}
                  </div>
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
                  <p className="font-semibold">{formatDisplayTime(onlineConsultation?.scheduledStart || consultation.time)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div>
              <p className="text-sm text-gray-600">Veterinarian</p>
              <p className="font-semibold text-lg">{veterinarianName}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Payment Status</span>
              <span className={`rounded-full border px-3 py-1 text-sm font-bold ${
                paymentStatus === "Verified"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
              }`}>
                {paymentStatus}
              </span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-gray-600">Booking amount</span>
              <span className="font-semibold text-lg">{paymentAmount}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {isCompleted && (
        <Card className="border-emerald-200 bg-white dark:border-emerald-900/70 dark:bg-slate-900">
          <CardHeader>
            <CardTitle>Consultation outcome</CardTitle>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Clinical details recorded by {veterinarianName}
              {onlineConsultation?.endedAt ? ` on ${formatDisplayDateTime(onlineConsultation.endedAt)}` : ""}.
            </p>
          </CardHeader>
          <CardContent>
            {clinicalDetails.length > 0 ? (
              <dl className="divide-y divide-slate-100 border-y border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                {clinicalDetails.map(([label, value]) => (
                  <div key={label} className="grid gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-5">
                    <dt className="text-sm font-bold text-slate-500 dark:text-slate-400">{label}</dt>
                    <dd className="whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-900 dark:text-slate-100">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-950/50">
                <p className="font-bold text-slate-900 dark:text-white">No clinical summary was recorded</p>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Contact the clinic if you expected diagnosis or treatment notes for this consultation.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showJoinCard && (
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
                    ? "Your veterinarian has started the consultation. Click below to join the 8x8 JaaS room."
                    : resolvedStatus !== "confirmed"
                      ? "The 8x8 JaaS room will be created after admin approval."
                      : !onlineConsultation?.meetingUrl
                        ? "The consultation room is not available yet."
                        : "Waiting for the veterinarian to start the consultation. You can join as soon as the room is ready."}
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
                {!canJoin && resolvedStatus === "confirmed" && onlineConsultation?.meetingUrl && (
                  <p className="text-sm text-gray-600 mt-2">
                    The vet must start the session before you can join. This page refreshes automatically.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isCompleted && !isCancelled && !isScheduledTimePast && (
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

      {isScheduledTimePast && !isCompleted && !isCancelled && !vetHasStarted && (
        <Card className="border-gray-300 bg-gray-50">
          <CardContent className="pt-6 text-center">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="font-semibold text-lg mb-2">Scheduled time has passed</h3>
            <p className="text-gray-600">Contact the clinic if this consultation still needs an updated status.</p>
          </CardContent>
        </Card>
      )}

      {!isCompleted && !isCancelled && !isScheduledTimePast && (
        <Card>
          <CardHeader>
            <CardTitle>What to Prepare</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-gray-700">
              {[
                "Ensure you have a stable internet connection",
                "Have your pet nearby during the consultation",
                "Prepare any medical records or documents you want to discuss",
                "Be in a quiet, well-lit area for the video call"
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

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
                placeholder="Cancellation reason"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">Wallet Number</label>
                <Input
                  value={cancellationData.walletNumber}
                  onChange={(event) => setCancellationData({ ...cancellationData, walletNumber: normalizePhilippinePhoneInput(event.target.value) })}
                  inputMode="tel"
                  restriction="phone"
                  maxLength={13}
                  placeholder="+639"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">Transaction Number</label>
                <Input
                  value={cancellationData.transactionNumber}
                  onChange={(event) => setCancellationData({ ...cancellationData, transactionNumber: normalizeTransactionNumber(event.target.value) })}
                  restriction="digits"
                  inputMode="numeric"
                  maxLength={TRANSACTION_NUMBER_LENGTH}
                  placeholder="Enter exactly 18 digits"
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
      <PhotoViewer
        src={viewerImage?.src}
        alt={viewerImage?.alt}
        open={Boolean(viewerImage)}
        onOpenChange={(open) => {
          if (!open) setViewerImage(null);
        }}
      />
    </div>
  );
}
