import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Home as HomeIcon, Hotel, Sparkles, Scissors, Syringe, Heart, Stethoscope, Bug, Activity } from "lucide-react";
import { toast } from "../../reusecomponent/toast.jsx";

export default function Services() {
  const navigate = useNavigate();

  const handleBookService = (path) => {
    navigate(path);
  };

  const services = [
    {
      id: "general-checkup",
      title: "General Check-up",
      description: "Comprehensive health examination",
      icon: Stethoscope,
      color: "bg-blue-100 text-blue-600",
      path: "/dashboard/services/general-checkup"
    },
    {
      id: "parasite-control",
      title: "Parasite Control",
      description: "Prevention and treatment",
      icon: Bug,
      color: "bg-orange-100 text-orange-600",
      path: "/dashboard/services/parasite-control"
    },
    {
      id: "surgery",
      title: "Surgery",
      description: "Surgical procedures and care",
      icon: Activity,
      color: "bg-red-100 text-red-600",
      path: "/dashboard/services/surgery"
    },
    {
      id: "vaccination",
      title: "Vaccination",
      description: "Immunization and boosters",
      icon: Syringe,
      color: "bg-green-100 text-green-600",
      path: "/dashboard/services/vaccination"
    },
    {
      id: "grooming",
      title: "Grooming",
      description: "Professional pet grooming",
      icon: Scissors,
      color: "bg-pink-100 text-pink-600",
      path: "/dashboard/services/grooming"
    },
    {
      id: "dental-checkup",
      title: "Dental Check-up",
      description: "Oral health and dental care",
      icon: Heart,
      color: "bg-cyan-100 text-cyan-600",
      path: "/dashboard/services/dental-checkup"
    },
    {
      id: "home-services",
      title: "Home Services",
      description: "Pet care services at your doorstep",
      icon: HomeIcon,
      color: "bg-blue-100 text-blue-600",
      path: "/dashboard/services/home-services"
    },
    {
      id: "pet-hotel",
      title: "Pet Hotel & Boarding",
      description: "Accommodation for your pets",
      icon: Hotel,
      color: "bg-purple-100 text-purple-600",
      path: "/dashboard/services/pet-hotel"
    },
    {
      id: "special-services",
      title: "Special Services",
      description: "Customized care packages and treatments",
      icon: Sparkles,
      color: "bg-purple-100 text-purple-600",
      path: "/dashboard/services/special-services"
    }
  ];

  return (
    <div className="space-y-6 lg:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Pet Services</h1>
      </div>

      {/* Service Categories */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <Card 
              key={service.id}
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
              onClick={() => handleBookService(service.path)}
            >
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className={`w-16 h-16 ${service.color} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <Icon className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">{service.title}</h3>
                  <Button variant="outline" className="w-full">
                    Book Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Information Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle>📋 Booking Information</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-gray-700">
            <li className="flex gap-2">
              <span className="text-blue-600">•</span>
              <span>All service bookings require admin approval before confirmation</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600">•</span>
              <span>Payment will be processed after your booking is reviewed and approved</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600">•</span>
              <span>You will receive a notification once your booking status is updated</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600">•</span>
              <span>Cancellations must be made at least 24 hours in advance</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
