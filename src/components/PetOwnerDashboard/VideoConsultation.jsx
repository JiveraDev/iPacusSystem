import userPhoto from "../../assets/circular_logo.png";
import { useParams, useNavigate } from "./dashboardRouter";
import { useState, useEffect } from "react";
import { ImageWithFallback } from "../../components/figma/ImageWithFallback";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff
} from "lucide-react";

export default function VideoConsultation() {
  const { consultationId } = useParams();
  const navigate = useNavigate();
  const [consultation, setConsultation] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const user = users.find((u) => u.id === currentUser.id);
    
    if (user && user.consultations) {
      const found = user.consultations.find((c) => c.id === consultationId);
      if (found) {
        setConsultation(found);
      } else {
        navigate("/dashboard/consult");
      }
    } else {
      navigate("/dashboard/consult");
    }
  }, [consultationId, navigate]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    if (window.confirm("Are you sure you want to end this consultation?")) {
      navigate("/dashboard/consult");
    }
  };

  if (!consultation) {
    return null;
  }

  const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const ownerName = currentUser.name || "You";

  return (
    <div className="relative w-full h-[calc(100vh-4rem)]">
      {/* Main Video Container */}
      <div className="relative w-full h-full bg-[#1a1a1a]">
        {/* Veterinarian Video - Full Background */}
        <div className="absolute inset-0">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1753487050317-919a2b26a6ed?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2ZXRlcmluYXJpYW4lMjBkb2N0b3IlMjBmZW1hbGUlMjBwcm9mZXNzaW9uYWx8ZW58MXx8fHwxNzcyMzQ2MTg1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
            alt="Veterinarian"
            className="w-full h-full object-cover object-top"
          />
        </div>

        {/* Veterinarian Name Label */}
        <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full">
          <p className="text-white font-bold text-[15px]">{consultation.veterinarian}</p>
        </div>

        {/* Your Video - Picture in Picture (Top Right) */}
        <div className="absolute top-6 right-6 w-[180px] h-[240px] bg-[#2a2a2a] rounded-2xl overflow-hidden border-[1.2px] border-white/20 shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]">
          <ImageWithFallback
            src={userPhoto}
            alt="You"
            className="w-full h-full object-cover object-top scale-[2]"
          />
          <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <p className="text-white font-bold text-[11px]">You</p>
          </div>
          {!isVideoOn && (
            <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
              <VideoOff className="h-8 w-8 text-white/60" />
            </div>
          )}
        </div>

        {/* Call Controls */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm rounded-full px-6 py-4 flex items-center gap-4">
          {/* Mic Button */}
          <button
            onClick={() => setIsMicOn(!isMicOn)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] transition-colors ${
              isMicOn 
                ? "bg-[#155dfc] hover:bg-[#1248d0]" 
                : "bg-red-500 hover:bg-red-600"
            }`}
            aria-label={isMicOn ? "Mute" : "Unmute"}
          >
            {isMicOn ? <Mic className="h-5 w-5 text-white" /> : <MicOff className="h-5 w-5 text-white" />}
          </button>

          {/* Video Button */}
          <button
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] transition-colors ${
              isVideoOn 
                ? "bg-[#155dfc] hover:bg-[#1248d0]" 
                : "bg-red-500 hover:bg-red-600"
            }`}
            aria-label={isVideoOn ? "Turn off camera" : "Turn on camera"}
          >
            {isVideoOn ? <Video className="h-5 w-5 text-white" /> : <VideoOff className="h-5 w-5 text-white" />}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="w-14 h-14 rounded-full bg-[#fb2c36] hover:bg-[#e01f29] flex items-center justify-center shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] transition-colors"
            aria-label="End call"
          >
            <PhoneOff className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Call Info Banner - Top Center */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-6 py-2 rounded-full flex items-center gap-3">
          <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-white font-medium text-sm">{formatDuration(duration)}</span>
        </div>
      </div>
    </div>
  );
}

