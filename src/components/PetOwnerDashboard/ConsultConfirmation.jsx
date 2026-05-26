import { useEffect, useState } from "react";
import { useNavigate, useParams } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { CheckCircle, Calendar, Clock, Video, ExternalLink, AlertCircle } from "lucide-react";

export default function ConsultConfirmation() {
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const [consultation, setConsultation] = useState(null);
  const [canJoin, setCanJoin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchConsultation = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/bookings?bookingId=${bookingId}`);
        if (!response.ok) throw new Error("Failed to fetch booking");
        
        const data = await response.json();
        // get_bookings returns an array
        const consult = data.find(b => b.id.toString() === bookingId.toString());
        
        if (consult) {
          setConsultation(consult);
          
          // Check if consultation time has arrived (allow joining 10 minutes before)
          const consultDateTime = new Date(`${consult.date} ${consult.time}`);
          const tenMinutesBefore = new Date(consultDateTime.getTime() - 10 * 60000);
          const now = new Date();
          
          setCanJoin(now >= tenMinutesBefore);
        }
      } catch (error) {
        console.error("Error fetching consultation:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (bookingId) {
      fetchConsultation();
    }
  }, [bookingId]);

  const handleJoinConsultation = () => {
    if (consultation && canJoin) {
      // In a real app, this would open the video consultation link
      // For now, navigate to the internal video page
      navigate(`/dashboard/consult/video/${consultation.id}`);
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

  const consultDateTime = new Date(`${consultation.date} ${consultation.time}`);
  const isPast = new Date() > consultDateTime;

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Consultation Confirmed!</h1>
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
                  <p className="text-sm">{consultation.notes}</p>
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
                  <p className="font-semibold">{consultDateTime.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-blue-600 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Time</p>
                  <p className="font-semibold">{consultation.time}</p>
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
              <span className="font-semibold text-lg">₱500</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isPast && (
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
                  {canJoin ? "Join Your Consultation" : "Consultation Link"}
                </h3>
                <p className="text-gray-700 mb-4">
                  {canJoin 
                    ? "Your consultation is ready! Click the button below to join the video call."
                    : "The join button will become active 10 minutes before your scheduled time."
                  }
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
                {!canJoin && (
                  <p className="text-sm text-gray-600 mt-2">
                    Available from: {new Date(consultDateTime.getTime() - 10 * 60000).toLocaleString()}
                  </p>
                )}
              </div>
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
    </div>
  );
}

