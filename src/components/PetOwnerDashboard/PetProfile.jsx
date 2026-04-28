import { useEffect, useState } from "react";
import { useNavigate, useParams } from "./dashboardRouter";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { ArrowLeft, FileText, PawPrint, Syringe, AlertCircle, Printer, Loader2, Copy, Check } from "lucide-react";
import { toast } from "../../reusecomponent/toast.jsx";

import { findPetService } from "../../services/findPet";

export default function PetProfile() {
  const navigate = useNavigate();
  const { petId } = useParams();
  const [pet, setPet] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchPet() {
      try {
        const data = await findPetService(petId);
        setPet(data);
      } catch (error) {
        console.error("Error fetching pet:", error);
        toast.error("Could not load pet profile");
      } finally {
        setIsLoading(false);
      }
    }

    if (petId) {
      fetchPet();
    }
  }, [petId]);

  const copyToClipboard = () => {
    if (pet?.id) {
      navigator.clipboard.writeText(pet.id);
      setCopied(true);
      toast.success("Registration ID copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    // Navigate to medical records for printing/viewing full history
    navigate(`/dashboard/my-pets/${petId}/medical-records`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600">Loading pet profile...</p>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="space-y-8">
        <Button variant="ghost" onClick={() => navigate("/dashboard/my-pets")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Pets
        </Button>
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <PawPrint className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Pet Not Found</h3>
            <p className="text-gray-600 mb-4">
              We couldn't find the pet you're looking for. It might not be linked to your account.
            </p>
            <Button onClick={() => navigate("/dashboard/my-pets")}>
              Back to My Pets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/dashboard/my-pets")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-white border-blue-200 text-blue-700 px-3 py-1">
            Reg ID: {pet.id}
          </Badge>
          <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-8 w-8 p-0">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Main Profile Header */}
      <Card className="overflow-hidden border-none shadow-md">
        <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600" />
        <CardContent className="relative pt-0 pb-6 px-6">
          <div className="flex flex-col md:flex-row gap-6 items-end -mt-12">
            <div className="relative">
              {pet.profileImage ? (
                <img
                  src={pet.profileImage}
                  alt={pet.name}
                  className="w-32 h-32 rounded-2xl object-cover border-4 border-white shadow-lg bg-white"
                />
              ) : (
                <div className="w-32 h-32 rounded-2xl bg-white flex items-center justify-center border-4 border-white shadow-lg">
                  <div className="w-full h-full rounded-xl bg-slate-100 flex items-center justify-center">
                    <PawPrint className="h-16 w-16 text-slate-400" />
                  </div>
                </div>
              )}
              <Badge className={`absolute -bottom-2 -right-2 px-3 py-1 shadow-sm ${
                pet.status === 'Healthy' 
                  ? 'bg-green-500 hover:bg-green-600' 
                  : pet.status === 'Under Treatment'
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
                  : 'bg-red-500 hover:bg-red-600'
              }`}>
                {pet.status}
              </Badge>
            </div>
            
            <div className="flex-1 space-y-1">
              <h1 className="text-3xl font-bold text-gray-900">{pet.name}</h1>
              <p className="text-lg text-gray-500 flex items-center gap-2">
                {pet.species} • {pet.breed}
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => navigate(`/dashboard/my-pets/${petId}/medical-records`)} className="bg-blue-600 hover:bg-blue-700">
                <FileText className="h-4 w-4 mr-2" />
                Medical Records
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Stats */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                Quick Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-gray-600">Owner</span>
                <span className="font-semibold text-blue-600">{pet.ownerName || 'Not linked'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-gray-600">Age</span>
                <span className="font-semibold">{pet.age || 'N/A'} years</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-gray-600">Gender</span>
                <span className="font-semibold">{pet.gender || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-gray-600">Weight</span>
                <span className="font-semibold">{pet.weight ? `${pet.weight} kg` : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Color</span>
                <span className="font-semibold">{pet.color || 'N/A'}</span>
              </div>
            </CardContent>
          </Card>

          {pet.microchipId && (
            <Card className="bg-blue-50 border-blue-100">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                    <Badge variant="ghost" className="p-0">MC</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-semibold uppercase">Microchip ID</p>
                    <p className="font-mono text-blue-900 font-bold">{pet.microchipId}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Allergies Card */}
          <Card className={pet.allergies?.length > 0 ? "border-orange-200 bg-orange-50" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider">
                <AlertCircle className={`h-4 w-4 ${pet.allergies?.length > 0 ? "text-orange-600" : "text-gray-400"}`} />
                Allergies
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pet.allergies?.length > 0 ? (
                <div className="space-y-2">
                  {pet.allergies.map((allergy, idx) => (
                    <div key={idx} className="bg-white p-2 rounded border border-orange-100 text-sm">
                      <span className="font-bold text-orange-900">{allergy.allergen}</span>
                      <span className="mx-2 text-gray-300">|</span>
                      <span className="text-orange-700">{allergy.severity}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No known allergies recorded.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Vaccinations & Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="hover:shadow-md transition-shadow cursor-pointer bg-green-50 border-green-100" 
                  onClick={() => navigate(`/dashboard/my-pets/${petId}/request-update`)}>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="h-10 w-10 bg-green-200 rounded-full flex items-center justify-center text-green-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-green-900">Update Record</h4>
                  <p className="text-xs text-green-700">Request data changes</p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer bg-blue-50 border-blue-100"
                  onClick={handlePrint}>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="h-10 w-10 bg-blue-200 rounded-full flex items-center justify-center text-blue-700">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-blue-900">View History</h4>
                  <p className="text-xs text-blue-700">Detailed medical logs</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vaccination List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Syringe className="h-5 w-5 text-blue-600" />
                Vaccinations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pet.vaccinations?.length > 0 ? (
                <div className="space-y-4">
                  {pet.vaccinations.map((vax, index) => (
                    <div key={index} className="p-4 border rounded-xl hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-gray-900">{vax.name}</h4>
                          <p className="text-xs text-gray-500">By: {vax.applicator || vax.veterinarian}</p>
                        </div>
                        <Badge className={vax.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                          {vax.status}
                        </Badge>
                      </div>
                      <div className="flex gap-6 mt-3 pt-3 border-t border-gray-100 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs">Administered</p>
                          <p className="font-medium">{new Date(vax.date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs text-blue-600">Next Due</p>
                          <p className="font-bold text-blue-600">{new Date(vax.nextDue).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                  <Syringe className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No vaccination records found for this pet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
