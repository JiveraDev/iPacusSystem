import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Maximize2, Minimize2, PhoneOff, Video } from "lucide-react";
import { useParams, useNavigate } from "../dashboardRouter.jsx";
import { Button } from "../../ui/button";
import { toast } from "../../reusecomponent/toast.jsx";
import { formatDisplayDateTime } from "../../lib/date";
import { fetchOnlineConsultation } from "../../services/onlineConsultationService";
import { useVideoCall } from "../../context/VideoCallProvider.jsx";

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
        const data = await fetchOnlineConsultation(consultationId);
        const found = Array.isArray(data) ? data[0] : data;

        if (found?.meetingUrl) {
          setConsultation(found);
          startCall({
            consultationId: found.id || consultationId,
            role: "pet_owner",
            meetingUrl: found.meetingUrl,
            meetingCode: found.meetingCode,
            title: "Online Consultation",
            petName: found.petName,
            ownerName: found.ownerName,
            veterinarianName: found.veterinarianName,
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
  }, [consultationId, navigate, startCall]);

  const handleEndCall = () => {
    endCall();
    navigate("/dashboard/consult");
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
      meetingCode: consultation.meetingCode,
      title: "Online Consultation",
      petName: consultation.petName,
      ownerName: consultation.ownerName,
      veterinarianName: consultation.veterinarianName,
      scheduledStart: consultation.scheduledStart,
      returnPath: `/dashboard/consult/video/${consultation.id || consultationId}`
    });
  };

  return (
    <div className="flex h-[calc(100vh-120px)] min-h-[680px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Online Consultation</h1>
            <p className="text-sm text-slate-500">
              {consultation.petName || "Your pet"} with {consultation.veterinarianName || "Veterinarian"} - {formatDisplayDateTime(consultation.scheduledStart)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-[#101828]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-white">
          <div>
            <p className="text-sm font-semibold">Jitsi Meeting Room</p>
            <p className="text-xs text-white/60">{consultation.meetingCode || "Private consultation room"}</p>
          </div>
          <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-100">Live</span>
        </div>

        <div className="flex h-full min-h-[560px] flex-col items-center justify-center p-6 text-center text-white">
          <Video className="mb-4 h-12 w-12 text-white/60" />
          <h2 className="text-xl font-bold">{isMinimized ? "Call minimized" : "Call open"}</h2>
          <p className="mt-2 max-w-md text-sm text-white/70">
            {consultation.meetingCode || "Private consultation room"}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={openCall} className="gap-2 bg-[#155dfc] hover:bg-[#0d4acf]">
              <Maximize2 className="h-4 w-4" />
              Open Call
            </Button>
            <Button
              variant="ghost"
              onClick={minimizeCall}
              className="gap-2 border border-white/20 text-white hover:bg-white/10"
            >
              <Minimize2 className="h-4 w-4" />
              Minimize
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-white/10 bg-black/20 px-5 py-3 text-sm text-white/70">
          <Video className="h-4 w-4" />
          Public Jitsi may ask the veterinarian to log in as moderator before the room fully opens.
        </div>
      </div>
    </div>
  );
}
