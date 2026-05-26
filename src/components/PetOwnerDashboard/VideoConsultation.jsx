import userPhoto from "../../assets/circular_logo.png";
import { useParams, useNavigate } from "../dashboardRouter.jsx";
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
    const fetchConsultation = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/bookings?bookingId=${consultationId}`);
        if (!response.ok) throw new Error("Failed to fetch booking");
        
        const data = await response.json();
        const found = data.find(b => b.id.toString() === consultationId.toString());
        
        if (found) {
          setConsultation(found);
        } else {
          navigate("/dashboard/consult");
        }
      } catch (error) {
        console.error("Error fetching consultation:", error);
        navigate("/dashboard/consult");
      }
    };

    if (consultationId) {
      fetchConsultation();
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
        <div className="absolute left-3 top-3 max-w-[calc(100%-8rem)] rounded-full bg-black/60 px-3 py-2 backdrop-blur-sm sm:left-6 sm:top-6 sm:max-w-none sm:px-4">
          <p className="truncate text-[13px] font-bold text-white sm:text-[15px]">{consultation.veterinarian}</p>
        </div>

        {/* Your Video - Picture in Picture (Top Right) */}
        <div className="absolute right-3 top-3 h-[132px] w-[96px] overflow-hidden rounded-2xl border-[1.2px] border-white/20 bg-[#2a2a2a] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] sm:right-6 sm:top-6 sm:h-[240px] sm:w-[180px]">
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
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/40 px-4 py-3 backdrop-blur-sm sm:bottom-8 sm:gap-4 sm:px-6 sm:py-4">
          {/* Mic Button */}
          <button
            onClick={() => setIsMicOn(!isMicOn)}
            className={`flex size-11 items-center justify-center rounded-full shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] transition-colors sm:size-14 ${
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
            className={`flex size-11 items-center justify-center rounded-full shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] transition-colors sm:size-14 ${
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
            className="flex size-11 items-center justify-center rounded-full bg-[#fb2c36] shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] transition-colors hover:bg-[#e01f29] sm:size-14"
            aria-label="End call"
          >
            <PhoneOff className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Call Info Banner - Top Center */}
        <div className="absolute left-1/2 top-[4.5rem] flex -translate-x-1/2 items-center gap-3 rounded-full bg-black/60 px-4 py-2 backdrop-blur-sm sm:top-6 sm:px-6">
          <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-white font-medium text-sm">{formatDuration(duration)}</span>
        </div>
      </div>
    </div>
  );
}
