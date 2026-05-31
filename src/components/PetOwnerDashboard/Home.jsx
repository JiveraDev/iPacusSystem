import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Heart, Clock, Calendar, Stethoscope, Video, FileText, PawPrint, ListTodo, Package, Plus } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome Back!</h1>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/dashboard/consult")}>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Video className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">Book Consultation</h3>
                <p className="text-sm text-gray-600">Online vet consultation</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/dashboard/services")}>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold">Pet Services</h3>
                <p className="text-sm text-gray-600">Home care & boarding</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/dashboard/my-pets")}>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <PawPrint className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">My Pets</h3>
                <p className="text-sm text-gray-600">View pet profiles</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate("/dashboard/todos")}>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                <ListTodo className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold">TODOs</h3>
                <p className="text-sm text-gray-600">Manage tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Landing Page Content */}
      <div className="space-y-12 lg:space-y-16">
        {/* The Clinic Section */}
        <section id="clinic">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">About Vetfocus Care Animal Clinic</h2>
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            <div>
              <p className="text-gray-600 mb-4">
                Vetfocus Care Animal Clinic is a highly-rated veterinary facility in Lucena City, known for providing reliable medical attention for pets with a focus on comprehensive care. With a strong 4.4 star rating, we are well-regarded by pet owners for our professional staff and quality medical services.
              </p>
              <p className="text-gray-600 mb-4">
                Our clinic is equipped for essential veterinary care including professional consultations, physical examinations, surgical procedures, and laboratory diagnostics. We also provide preventative care through deworming and heartworm prevention, along with nutritional advice and prescription diets.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-blue-600" />
                  <span>Expert Veterinarians</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <span>Daily 8AM - 6PM</span>
                </div>
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-blue-600" />
                  <span>Full Grooming Services</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span>On-Site Pharmacy</span>
                </div>
              </div>
            </div>
            <div className="rounded-lg overflow-hidden shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1625321171045-1fea4ac688e9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2ZXRlcmluYXJpYW4lMjBleGFtaW5pbmclMjBwZXR8ZW58MXx8fHwxNzcwMjM3OTY1fDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Veterinarian examining pet"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* Announcements Section */}
        <section id="announcements">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Latest Announcements</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Holiday Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Our clinic will have modified hours during the upcoming holiday season. Regular appointments are available, and emergency services remain 24/7.
                </p>
                <p className="text-sm text-gray-500 mt-2">Posted: Feb 1, 2026</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-blue-600" />
                  Free Health Checkup Week
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Join us for our annual Free Health Checkup Week from Feb 10-16. Book your appointment online to support your pet's health!
                </p>
                <p className="text-sm text-gray-500 mt-2">Posted: Jan 28, 2026</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5 text-blue-600" />
                  Online Consultations Now Available
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  We're excited to announce our new online consultation service! Get expert advice from the comfort of your home.
                </p>
                <p className="text-sm text-gray-500 mt-2">Posted: Jan 25, 2026</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Online Consultation Instructions */}
        <section id="online-consultation">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
            How to Book an Online Consultation
          </h2>
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8 mb-8">
            <div>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Select Your Pet</h3>
                    <p className="text-gray-600">
                      Choose from your registered pets and specify the consultation topic.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Select Available Time</h3>
                    <p className="text-gray-600">
                      Choose from our veterinarians' available time slots. Bookings are available for next day onwards.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Complete Payment</h3>
                    <p className="text-gray-600">
                      Secure online payment via Maya. You'll receive a confirmation immediately after payment.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Join the Consultation</h3>
                    <p className="text-gray-600">
                      Access your consultation link at the scheduled time through your dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-lg overflow-hidden shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1758691463620-188ca7c1a04f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvbmxpbmUlMjBjb25zdWx0YXRpb24lMjBsYXB0b3B8ZW58MXx8fHwxNzcwMjM3OTY1fDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Online consultation"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle>Consultation Fee</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">
                Online consultations are priced at <span className="font-bold text-blue-600">PHP 500 per session</span>. This includes a 30-minute video call with our experienced veterinarians and a follow-up summary report.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Clinic Instructions */}
        <section id="clinic-info">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
            Clinic Information & Guidelines
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Operating Hours</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Every Day:</span>
                  <span>8:00 AM - 6:00 PM</span>
                </div>
                <p className="text-sm text-gray-600 mt-4">
                  Open daily with consistent hours for your convenience
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="font-medium block mb-1">Address:</span>
                  <span className="text-gray-700">
                    Oakbrook Avenue, Phase 3,<br />
                    Pleasantville Subdivision,<br />
                    Corner Clayton, Ilayang Iyam,<br />
                    Lucena City
                  </span>
                </div>
                <div>
                  <span className="font-medium">Phone:</span>
                  <span className="ml-2">(042) 373-5678</span>
                </div>
                <div>
                  <span className="font-medium">Email:</span>
                  <span className="ml-2">info@vetfocuscare.com</span>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Visit Guidelines</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-gray-700">
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Please arrive 10 minutes before your scheduled appointment</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Bring your pet's vaccination records for first visits</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Keep your pet on a leash or in a carrier for safety</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Inform us of any behavioral concerns before your visit</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">•</span>
                  <span>Payment can be made via cash, card, or online transfer</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

