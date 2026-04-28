import { useNavigate } from "./dashboardRouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Syringe, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "../../reusecomponent/toast.jsx";

export default function Vaccination() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    petName: "",
    date: "",
    time: "",
    notes: "",
    files: [],
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    toast.success("Booking submitted! Awaiting admin approval.");
    navigate("/dashboard/services");
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFormData({ ...formData, files: Array.from(e.target.files) });
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/dashboard/services")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Vaccination</h1>
          <p className="text-gray-600 mt-1">Immunization and booster shots for your pet</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Booking Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
            <CardDescription>Fill in the information below to schedule your appointment</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="petName">Pet Name *</Label>
                <Input
                  id="petName"
                  required
                  placeholder="Enter your pet's name"
                  value={formData.petName}
                  onChange={(e) => setFormData({ ...formData, petName: e.target.value })}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Preferred Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Preferred Time *</Label>
                  <Input
                    id="time"
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Vaccination Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Which vaccines are needed? (e.g., Rabies, DHPP, Bordetella)"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="files">Upload Files (optional)</Label>
                <Input
                  id="files"
                  type="file"
                  multiple
                  onChange={handleFileChange}
                />
                <p className="text-xs text-gray-500">Upload medical records, X-rays, or other relevant documents</p>
              </div>

              <Button type="submit" className="w-full">
                Submit Booking Request
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Service Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Syringe className="h-8 w-8" />
              </div>
              <CardTitle className="text-center">Vaccination</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <h4 className="font-semibold mb-2">Common Vaccines:</h4>
                  <ul className="space-y-1 ml-4">
                    <li>• Rabies</li>
                    <li>• DHPP (Distemper, Hepatitis, Parvo, Parainfluenza)</li>
                    <li>• Bordetella</li>
                    <li>• Leptospirosis</li>
                    <li>• Feline Leukemia (cats)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Duration:</h4>
                  <p>15-20 minutes</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Price:</h4>
                  <p className="text-lg font-bold text-green-600">$30-$60 per vaccine</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <p className="text-sm text-gray-700">
                ℹ️ Your booking will be reviewed by our team. You'll receive a confirmation email once approved.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

