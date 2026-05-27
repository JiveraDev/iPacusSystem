import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, PhoneOff, Video } from "lucide-react";
import { useParams, useNavigate } from "../dashboardRouter.jsx";
import { Button } from "../../ui/button";
import { toast } from "../../reusecomponent/toast.jsx";
import { formatDisplayDateTime } from "../../lib/date";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function VideoConsultation() {
  const { consultationId } = useParams();
  const navigate = useNavigate();
  const [consultation, setConsultation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConsultation = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/online-consultations/${consultationId}`);
        const data = await response.json().catch(() => []);

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch online consultation");
        }

        const found = Array.isArray(data) ? data[0] : data;

        if (found?.meetingUrl) {
          setConsultation(found);
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
  }, [consultationId, navigate]);

  const handleEndCall = () => {
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

  return (
    <div className="flex h-[calc(100vh-120px)] min-h-[680px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard/consult")}
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

        <Button variant="destructive" onClick={handleEndCall} className="gap-2">
          <PhoneOff className="h-4 w-4" />
          Leave
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-[#101828]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-white">
          <div>
            <p className="text-sm font-semibold">Jitsi Meeting Room</p>
            <p className="text-xs text-white/60">{consultation.meetingCode || "Private consultation room"}</p>
          </div>
          <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-100">Live</span>
        </div>

        <iframe
          title="Jitsi online consultation"
          src={consultation.meetingUrl}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="h-full min-h-[560px] w-full border-0"
        />

        <div className="flex items-center gap-2 border-t border-white/10 bg-black/20 px-5 py-3 text-sm text-white/70">
          <Video className="h-4 w-4" />
          Public Jitsi may ask the veterinarian to log in as moderator before the room fully opens.
        </div>
      </div>
    </div>
  );
}
