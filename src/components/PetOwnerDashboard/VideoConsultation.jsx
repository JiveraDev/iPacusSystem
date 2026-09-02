import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Maximize2, Minimize2, PhoneOff, Video } from "lucide-react";
import { useParams, useNavigate } from "../dashboardRouter.jsx";
import { Button } from "../../ui/button";
import { toast } from "../../reusecomponent/toast.jsx";
import { formatDisplayDateTime } from "../../lib/date";
import { joinOnlineConsultation } from "../../services/onlineConsultationService";
import { useVideoCall } from "../../context/VideoCallProvider.jsx";
import DashboardPageHeader from "../shared/DashboardPageHeader.jsx";

const CLOSED_CONSULTATION_STATUSES = new Set(["completed", "cancelled", "canceled", "no_show", "no-show"]);

function isClosedConsultation(consultation) {
  const consultationStatus = String(consultation?.status || "").trim().toLowerCase();
  const bookingStatus = String(consultation?.bookingStatus || consultation?.booking_status || "").trim().toLowerCase();

  return CLOSED_CONSULTATION_STATUSES.has(consultationStatus)
    || CLOSED_CONSULTATION_STATUSES.has(bookingStatus);
}

export default function VideoConsultation() {
  const { consultationId } = useParams();
  const navigate = useNavigate();
  const { activeCall, isMinimized, startCall, minimizeCall, maximizeCall, endCall } = useVideoCall();
  const [consultation, setConsultation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConsultation = async () => {
      setIsLoading(true);
      try {
        // Always enter through the join action. This keeps notification deep
        // links secure and records the owner as present in the live room.
        const data = await joinOnlineConsultation(consultationId);
        const found = Array.isArray(data) ? data[0] : data;

        if (isClosedConsultation(found)) {
          endCall();
          toast.info("This online consultation has already ended.");
          navigate("/dashboard/consult", { replace: true });
          return;
        }

        if (found?.meetingUrl) {
          setConsultation(found);
          startCall({
            consultationId: found.id || consultationId,
            role: "pet_owner",
            meetingUrl: found.meetingUrl,
            meetingJwt: found.meetingJwt,
            meetingCode: found.meetingCode,
            title: "Online Consultation",
            petName: found.petName,
            ownerName: found.ownerName,
            veterinarianName: found.veterinarianName,
            displayName: found.ownerName,
            email: found.ownerEmail,
            scheduledStart: found.scheduledStart,
            returnPath: `/dashboard/consult/video/${found.id || consultationId}`
          });
        } else {
          toast.error("Consultation room is not available.");
          navigate("/dashboard/consult");
        }
      } catch (error) {
        console.error("Error fetching consultation:", error);
        toast.error(error.message || "Failed to load consultation room");
        navigate("/dashboard/consult");
      } finally {
        setIsLoading(false);
      }
    };

    if (consultationId) {
      fetchConsultation();
    }
  }, [consultationId, endCall, navigate, startCall]);

  const handleEndCall = () => {
    endCall();
    navigate("/dashboard/consult", { replace: true });
  };

  const handleBack = () => {
    minimizeCall();
    navigate("/dashboard/consult");
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading consultation room...
      </div>
    );
  }

  if (!consultation) {
    return null;
  }

  const isCurrentCall = Boolean(activeCall?.meetingUrl && activeCall.meetingUrl === consultation.meetingUrl);
  const openCall = () => {
    if (isCurrentCall) {
      maximizeCall();
      return;
    }

    startCall({
      consultationId: consultation.id || consultationId,
      role: "pet_owner",
      meetingUrl: consultation.meetingUrl,
      meetingJwt: consultation.meetingJwt,
      meetingCode: consultation.meetingCode,
      title: "Online Consultation",
      petName: consultation.petName,
      ownerName: consultation.ownerName,
      veterinarianName: consultation.veterinarianName,
      displayName: consultation.ownerName,
      email: consultation.ownerEmail,
      scheduledStart: consultation.scheduledStart,
      returnPath: `/dashboard/consult/video/${consultation.id || consultationId}`
    });
  };

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-0 flex-col gap-4 overflow-y-auto lg:h-[calc(100vh-120px)] lg:min-h-[680px] lg:overflow-hidden">
      <DashboardPageHeader
        icon={Video}
        title="Online Consultation"
        description={`${consultation.petName || "Your pet"} with ${consultation.veterinarianName || "Veterinarian"} - ${formatDisplayDateTime(consultation.scheduledStart)}`}
        className="shrink-0"
        navigation={(
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="-ml-2 gap-2 text-slate-600 dark:text-slate-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to consultations
          </Button>
        )}
        actions={(
          <>
          <Button variant="outline" onClick={isMinimized ? openCall : minimizeCall} className="gap-2">
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            {isMinimized ? "Open Call" : "Minimize"}
          </Button>
          <Button
            variant="ghost"
            onClick={handleEndCall}
            className="gap-2 border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          >
            <PhoneOff className="h-4 w-4" />
            Leave
          </Button>
          </>
        )}
      />

      <div className="flex min-h-[34rem] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-[#101828] dark:border-slate-800 lg:min-h-0">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-white">
          <div>
            <p className="text-sm font-semibold">8x8 JaaS Meeting Room</p>
            <p className="text-xs text-white/60">{consultation.meetingCode || "Private consultation room"}</p>
          </div>
          <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-100">Live</span>
        </div>

        <div
          data-video-call-dock={String(consultation.id || consultationId)}
          className="relative flex min-h-[460px] flex-1 items-center justify-center overflow-hidden bg-black p-6 text-center text-white sm:min-h-[560px]"
          aria-label="Online consultation video"
        >
          {(!isCurrentCall || isMinimized) && (
            <div className="max-w-md">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-white/10">
                <Video className="h-7 w-7 text-white/70" />
              </div>
              <h2 className="mt-4 text-xl font-bold">
                {isMinimized && isCurrentCall ? "Call continues in picture-in-picture" : "Ready to join"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                {isMinimized && isCurrentCall
                  ? "The camera call remains connected while you use other dashboard pages. Select the floating video to return."
                  : "Open the private consultation room when you are ready."}
              </p>
              <Button onClick={openCall} className="mt-5 gap-2 bg-[#155dfc] hover:bg-[#0d4acf]">
                <Maximize2 className="h-4 w-4" />
                {isMinimized && isCurrentCall ? "Return to Call" : "Open Call"}
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-white/10 bg-black/20 px-5 py-3 text-sm text-white/70">
          <Video className="h-4 w-4" />
          Video consultations are securely hosted through the clinic's 8x8 JaaS service.
        </div>
      </div>
    </div>
  );
}
