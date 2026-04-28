import { useEffect, useState } from "react";
import { useNavigate, useParams } from "./dashboardRouter";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { ArrowLeft, FileText, PawPrint, Syringe, AlertCircle, Printer, Loader2, Copy, Check } from "lucide-react";
import { toast } from "../../reusecomponent/toast.jsx";
import { resolveImageUrl } from "../../lib/image";

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
        // data is now formatted correctly by the backend
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
      // Fallback copy method for reliability
      const textArea = document.createElement('textarea');
      textArea.value = pet.id;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        toast.success("Pet ID copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Copy failed', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const handlePrint = () => {
    navigate(`/dashboard/my-pets/${petId}/medical-records`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 text-[#155dfc] animate-spin mb-4" />
        <p className="text-gray-600">Loading pet profile...</p>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <Button variant="ghost" onClick={() => navigate("/dashboard/my-pets")} className="hover:bg-slate-100">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Pets
        </Button>
        <Card className="border-slate-200">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <PawPrint className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-2">Pet Not Found</h3>
            <p className="text-slate-500 mb-8 max-w-sm mx-auto">
              We couldn't find the pet profile for ID: <span className="font-mono text-blue-600">{petId}</span>. 
              It might have been unlinked or the ID is incorrect.
            </p>
            <Button onClick={() => navigate("/dashboard/my-pets")} className="bg-[#155dfc]">
              Return to My Pets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button variant="ghost" onClick={() => navigate("/dashboard/my-pets")} className="w-fit hover:bg-slate-100">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registration ID</span>
          <code className="text-sm font-bold text-[#155dfc] bg-white px-3 py-1 rounded-lg border border-slate-200">
            {pet.id}
          </code>
          <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-8 w-8 p-0 hover:bg-white rounded-lg transition-colors">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-slate-400" />}
          </Button>
        </div>
      </div>

      {/* Main Profile Header */}
      <Card className="overflow-hidden border-none shadow-xl rounded-2xl bg-white">
        <div className="h-40 bg-gradient-to-r from-[#155dfc] via-blue-600 to-indigo-700 relative">
            <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px]" />
        </div>
        <CardContent className="relative pt-0 pb-8 px-8">
          <div className="flex flex-col md:flex-row gap-8 items-end -mt-16">
            <div className="relative">
              <div className="h-40 w-40 rounded-3xl overflow-hidden border-[6px] border-white shadow-2xl bg-slate-100 ring-1 ring-slate-100 transition-all duration-300 group-hover:ring-blue-100">
                {pet.profileImage ? (
                    <img
                        src={resolveImageUrl(pet.profileImage)}
                        alt={pet.name}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
                        <PawPrint className="h-20 w-20 text-blue-200" />
                    </div>
                )}
              </div>
              <Badge className={`absolute -bottom-3 -right-3 px-4 py-1.5 shadow-xl border-2 border-white rounded-full text-xs font-black uppercase tracking-widest ${
                pet.status === 'Healthy' 
                  ? 'bg-green-500 hover:bg-green-600' 
                  : pet.status === 'Emergency'
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}>
                {pet.status}
              </Badge>
            </div>
            
            <div className="flex-1 space-y-2 pb-2 text-center md:text-left">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">{pet.name}</h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <span className="text-lg text-slate-500 font-medium">{pet.species}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                <span className="text-lg text-slate-500 font-medium">{pet.breed}</span>
              </div>
            </div>

            <div className="flex gap-3 pb-2 w-full md:w-auto">
              <Button 
                onClick={() => navigate(`/dashboard/my-pets/${petId}/medical-records`)} 
                className="flex-1 md:flex-none bg-[#155dfc] hover:bg-blue-700 h-12 px-8 rounded-xl font-bold shadow-lg transition-all"
              >
                <FileText className="h-5 w-5 mr-2" />
                Medical Records
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Details & Stats */}
        <div className="lg:col-span-1 space-y-8">
          <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Biological Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">Primary Breed</span>
                <span className="font-bold text-slate-900">{pet.breed || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">Estimated Age</span>
                <span className="font-bold text-slate-900">{pet.age || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">Sex / Gender</span>
                <span className="font-bold text-slate-900">{pet.gender || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">Body Weight</span>
                <span className="font-bold text-[#155dfc]">{pet.weight ? `${pet.weight} kg` : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">Coloration</span>
                <span className="font-bold text-slate-900">{pet.color || 'N/A'}</span>
              </div>
            </CardContent>
          </Card>

          {pet.microchipId && (
            <Card className="bg-blue-600 border-none shadow-lg shadow-blue-200 rounded-2xl overflow-hidden">
              <CardContent className="p-6 relative">
                <div className="absolute right-0 top-0 h-full w-1/2 bg-white/10 skew-x-[-20deg] translate-x-8" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="p-3 bg-white/20 rounded-xl text-white backdrop-blur-md">
                    <Check className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-100 font-black uppercase tracking-widest">Microchip Verified</p>
                    <p className="font-mono text-xl text-white font-black mt-1 tracking-wider">{pet.microchipId}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Allergies Card */}
          <Card className={`rounded-2xl shadow-sm overflow-hidden ${pet.allergies?.length > 0 ? "border-red-100" : "border-slate-200"}`}>
            <CardHeader className={`${pet.allergies?.length > 0 ? "bg-red-50/50" : "bg-slate-50/50"} border-b border-slate-100`}>
              <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                <AlertCircle className={`h-4 w-4 ${pet.allergies?.length > 0 ? "text-red-500" : "text-slate-400"}`} />
                Critical Allergies
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {pet.allergies?.length > 0 ? (
                <div className="space-y-3">
                  {pet.allergies.map((allergy, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-red-50 shadow-sm">
                      <p className="font-black text-red-600 text-sm uppercase tracking-tight">{allergy.allergen}</p>
                      <p className="text-xs text-slate-400 mt-1 font-medium italic">{allergy.severity} Reaction Type</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                    <p className="text-sm text-slate-400 font-medium">No known clinical allergies recorded.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Vaccinations & Actions */}
        <div className="lg:col-span-2 space-y-8">
          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="group hover:shadow-xl transition-all cursor-pointer bg-white border-slate-200 hover:border-green-200 rounded-2xl overflow-hidden" 
                  onClick={() => navigate(`/dashboard/my-pets/${petId}/request-update`)}>
              <CardContent className="p-6 flex items-center gap-5">
                <div className="h-14 w-14 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 group-hover:bg-green-600 group-hover:text-white transition-all duration-300">
                  <FileText className="h-7 w-7" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-lg tracking-tight">Update Record</h4>
                  <p className="text-sm text-slate-500 font-medium">Submit data correction request</p>
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all cursor-pointer bg-white border-slate-200 hover:border-blue-200 rounded-2xl overflow-hidden"
                  onClick={handlePrint}>
              <CardContent className="p-6 flex items-center gap-5">
                <div className="h-14 w-14 bg-blue-50 rounded-2xl flex items-center justify-center text-[#155dfc] group-hover:bg-[#155dfc] group-hover:text-white transition-all duration-300">
                  <Printer className="h-7 w-7" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-lg tracking-tight">Health History</h4>
                  <p className="text-sm text-slate-500 font-medium">Export clinical medical logs</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vaccination List */}
          <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-8 py-6">
              <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-3">
                <Syringe className="h-6 w-6 text-[#155dfc]" />
                Immunization Records
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pet.vaccinations?.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {pet.vaccinations.map((vax, index) => (
                    <div key={index} className="p-8 hover:bg-slate-50 transition-colors group">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                        <div>
                          <h4 className="font-black text-slate-900 text-xl tracking-tight mb-1">{vax.name}</h4>
                          <div className="flex items-center gap-2 text-slate-400 text-sm">
                            <User className="h-3 w-3" />
                            <span className="font-medium">Administrator: {vax.applicator || vax.veterinarian}</span>
                          </div>
                        </div>
                        <Badge className={`px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-[0.15em] border-2 ${
                            vax.status === 'completed' 
                                ? 'bg-green-50 text-green-700 border-green-100' 
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {vax.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                        <div>
                          <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Last Administration</p>
                          <p className="font-extrabold text-slate-700 text-lg">{new Date(vax.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                        <div>
                          <p className="text-[#155dfc] text-xs font-black uppercase tracking-widest mb-1">Booster Due Date</p>
                          <p className="font-extrabold text-[#155dfc] text-lg">{new Date(vax.nextDue).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 px-8">
                  <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-lg">
                    <Syringe className="h-10 w-10 text-slate-200" />
                  </div>
                  <h4 className="text-slate-900 font-bold text-lg">No Vaccination Data</h4>
                  <p className="text-slate-400 mt-2 max-w-xs mx-auto">Clinical immunization records for this pet are currently empty or pending update.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
