import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Video, Calendar, Clock, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";

export default function Consult() {
  const navigate = useNavigate();
  const [upcomingConsultations, setUpcomingConsultations] = useState([]);

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const user = users.find((u) => u.id === currentUser.id);
    
    if (user && user.consultations) {
      const upcoming = user.consultations.filter((c) => 
        new Date(c.dateTime) >= new Date()
      );
      setUpcomingConsultations(upcoming);
    }
  }, []);

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
            <p>• Complete secure payment via Maya (₱500 per session)</p>
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
                <h3 className="font-semibold text-lg">Upcoming Consultations</h3>
                <p className="text-sm text-gray-600">{upcomingConsultations.length} scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {upcomingConsultations.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Your Upcoming Consultations</h2>
          <div className="space-y-4">
            {upcomingConsultations.map((consultation) => (
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
                      <p className="text-gray-600">Topic: {consultation.discussionTopic}</p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(consultation.dateTime).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>{new Date(consultation.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">Veterinarian: {consultation.veterinarian}</p>
                      
                      {consultation.consultationLink && (
                        <div className="pt-2">
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/dashboard/consult/video/${consultation.id}`)}
                            className="inline-flex items-center gap-2"
                          >
                            <Video className="h-4 w-4" />
                            Join Consultation
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
            ))}
          </div>
        </div>
      )}

      {upcomingConsultations.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Video className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No Upcoming Consultations</h3>
            <p className="text-gray-600 mb-4">You don't have any scheduled consultations yet.</p>
            <Button onClick={() => navigate("/dashboard/consult/booking")}>
              Book Your First Consultation
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
