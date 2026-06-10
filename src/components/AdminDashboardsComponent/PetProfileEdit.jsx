import { useEffect, useState } from "react";
import { useNavigate, useParams } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { 
  ArrowLeft, FileText, PawPrint, Syringe, AlertCircle, 
  Loader2, Copy, Check, Camera, Edit2, Save, X, Plus, Trash2
} from "lucide-react";
import { toast } from "../../reusecomponent/toast.jsx";
import { resolveImageUrl } from "../../lib/image";
import { calculateAge, formatDisplayDate } from "../../lib/date";

import { findPetService } from "../../services/findPet";
import { fetchPetMedicalRecords, savePetMedicalRecord, updatePetDetails } from "../../services/petService";
import { uploadFormData } from "../../services/uploadService";

export default function PetProfileEdit() {
  const navigate = useNavigate();
  const { petId } = useParams();
  
  const [pet, setPet] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsEditing] = useState(false); // Using this for UI state
  const [isEditMode, setIsEditMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMedicalLoading, setIsMedicalLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({});
  const [vaccinations, setVaccinations] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [prescriptionDocuments, setPrescriptionDocuments] = useState([]);

  // Medical record dialog states
  const [showAddVax, setShowAddVax] = useState(false);
  const [showAddAllergy, setShowAddAllergy] = useState(false);
  const [newVax, setNewVax] = useState({ name: "", date: "", nextDue: "", applicator: "", veterinarianLicense: "", notes: "", status: "completed" });
  const [newAllergy, setNewAllergy] = useState({ allergen: "", severity: "Known" });

  useEffect(() => {
    async function fetchPet() {
      try {
        const data = await findPetService(petId);
        setPet(data);
        setFormData({
          petName: data.name,
          species: data.species,
          breed: data.breed,
          birthDate: data.birthDate,
          gender: data.gender,
          status: data.status,
          weight: data.weight,
          microchipId: data.microchipId,
          color: data.color,
          tempOwner: data.ownerName,
          age: data.age
        });
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

  useEffect(() => {
    async function fetchMedical() {
      if (!pet?.db_id) return;
      setIsMedicalLoading(true);
      try {
        const data = await fetchPetMedicalRecords(petId);
        setVaccinations(data.vaccinations || []);
        setAllergies(data.allergies || []);
        setPrescriptionDocuments(data.prescriptionDocuments || []);
      } catch (error) {
        console.error("Failed to load medical records:", error);
      } finally {
        setIsMedicalLoading(false);
      }
    }
    fetchMedical();
  }, [pet?.db_id, petId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
        const newData = { ...prev, [name]: value };
        if (name === 'birthDate') {
            newData.age = calculateAge(value);
        }
        return newData;
    });
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async () => {
    setIsEditing(true);
    try {
      const result = await updatePetDetails(petId, formData);
      if (result.success) {
        toast.success("Pet profile updated successfully");
        setPet(prev => ({ ...prev, ...formData, name: formData.petName }));
        setIsEditMode(false);
      } else {
        toast.error(result.message || "Failed to update profile");
      }
    } catch {
      toast.error("An error occurred during save");
    } finally {
      setIsEditing(false);
    }
  };

  const handleAddVaccination = async () => {
    if (!newVax.name || !newVax.date || !newVax.nextDue) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      const data = await savePetMedicalRecord(petId, { type: 'vaccination', action: 'add', ...newVax });
      if (data.success) {
        setVaccinations(prev => [{ ...newVax, id: data.id }, ...prev]);
        setShowAddVax(false);
        setNewVax({ name: "", date: "", nextDue: "", applicator: "", veterinarianLicense: "", notes: "", status: "completed" });
        toast.success("Vaccination record added");
      }
    } catch {
      toast.error("Failed to add vaccination");
    }
  };

  const handleDeleteVaccination = async (id) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      await savePetMedicalRecord(petId, { type: 'vaccination', action: 'delete', id });
      setVaccinations(prev => prev.filter(v => v.id !== id));
      toast.success("Record deleted");
    } catch {
      toast.error("Failed to delete record");
    }
  };

  const handleAddAllergy = async () => {
    if (!newAllergy.allergen) return;
    try {
      const data = await savePetMedicalRecord(petId, { type: 'allergy', action: 'add', ...newAllergy });
      if (data.success) {
        setAllergies(prev => [...prev, { ...newAllergy, id: data.id }]);
        setShowAddAllergy(false);
        setNewAllergy({ allergen: "", severity: "Known" });
        toast.success("Allergy added");
      }
    } catch {
      toast.error("Failed to add allergy");
    }
  };

  const handleDeleteAllergy = async (id) => {
    try {
      await savePetMedicalRecord(petId, { type: 'allergy', action: 'delete', id });
      setAllergies(prev => prev.filter(a => a.id !== id));
      toast.success("Allergy removed");
    } catch {
      toast.error("Failed to remove allergy");
    }
  };

  const copyToClipboard = () => {
    const el = document.createElement('textarea');
    el.value = pet.id;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setCopied(true);
    toast.success("ID copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 text-[#155dfc] animate-spin mb-4" />
        <p className="text-gray-600">Loading pet profile...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl min-w-0 space-y-6 pb-12 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button variant="ghost" onClick={() => navigate("/dashboard/pet-register")} className="w-fit hover:bg-slate-100">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Register
        </Button>
        <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 shadow-sm sm:w-auto sm:px-4">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registration ID</span>
          <code className="min-w-0 max-w-full truncate rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-[#155dfc]">
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
        <CardContent className="relative px-4 pb-6 pt-0 sm:px-8 sm:pb-8">
          <div className="-mt-16 flex flex-col items-center gap-6 md:flex-row md:items-end md:gap-8">
            <div className="relative">
              <div className="h-32 w-32 overflow-hidden rounded-3xl border-[6px] border-white bg-slate-100 shadow-2xl ring-1 ring-slate-100 transition-all duration-300 group-hover:ring-blue-100 sm:h-40 sm:w-40">
                {pet.profileImage ? (
                    <img src={resolveImageUrl(pet.profileImage)} alt={pet.name} className="h-full w-full object-cover" />
                ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
                        <PawPrint className="h-20 w-20 text-blue-200" />
                    </div>
                )}
              </div>
              
              <input type="file" id="pet-pic-upload" className="hidden" accept="image/*" onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append('image', file);
                  formData.append('type', 'pet');
                  try {
                      const result = await uploadFormData(formData);
                      await updatePetDetails(pet.db_id, { setpetImage_url: result.relative_url });
                      toast.success("Profile picture updated!");
                      setPet(prev => ({ ...prev, profileImage: result.relative_url }));
                  } catch { toast.error("Upload failed."); }
              }}/>
              <label htmlFor="pet-pic-upload" className="absolute bottom-2 right-2 p-2 bg-blue-600 rounded-full text-white shadow-lg cursor-pointer hover:bg-blue-700 transition-colors">
                <Camera className="h-5 w-5" />
              </label>
            </div>
            
            <div className="min-w-0 flex-1 space-y-2 pb-2 text-center md:text-left">
              {isEditMode ? (
                <div className="space-y-4 max-w-sm">
                  <div className="space-y-1">
                    <Label className="text-white sm:text-slate-900">Pet Name</Label>
                    <Input name="petName" value={formData.petName} onChange={handleInputChange} className="text-2xl font-bold h-12" />
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="break-words text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{pet.name}</h1>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                    <span className="text-lg text-slate-500 font-medium">{pet.species}</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    <span className="text-lg text-slate-500 font-medium">{pet.breed}</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex w-full flex-col gap-3 pb-2 sm:flex-row md:w-auto">
              {isEditMode ? (
                <>
                  <Button onClick={() => setIsEditMode(false)} variant="outline" className="flex-1 h-12 px-8 rounded-xl font-bold">
                    <X className="h-4 w-4 mr-2" /> Cancel
                  </Button>
                  <Button onClick={handleSaveProfile} disabled={isSaving} className="flex-1 bg-green-600 hover:bg-green-700 h-12 px-8 rounded-xl font-bold shadow-lg">
                    {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button onClick={() => setIsEditMode(true)} className="flex-1 md:flex-none bg-[#155dfc] hover:bg-blue-700 h-12 px-8 rounded-xl font-bold shadow-lg transition-all">
                  <Edit2 className="h-5 w-5 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Biological Profile & Allergies */}
        <div className="lg:col-span-1 space-y-8">
          <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                Biological Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:space-y-4 sm:p-6">
              <BioField label="Species" name="species" value={formData.species} isEdit={isEditMode} onChange={handleInputChange} />
              <BioField label="Primary Breed" name="breed" value={formData.breed} isEdit={isEditMode} onChange={handleInputChange} />
              <BioField label="Owner Name" name="tempOwner" value={formData.tempOwner} isEdit={isEditMode} onChange={handleInputChange} />
              <BioField label="Birth Date" name="birthDate" value={formData.birthDate} type="date" isEdit={isEditMode} onChange={handleInputChange} />
              <BioField label="Sex / Gender" name="gender" value={formData.gender} isEdit={isEditMode} onChange={handleInputChange} isSelect options={['Male', 'Female', 'Neutered Male', 'Spayed Female']} onSelect={(v) => handleSelectChange('gender', v)} />
              <BioField label="Weight (kg)" name="weight" value={formData.weight} isEdit={isEditMode} onChange={handleInputChange} />
              <BioField label="Coloration" name="color" value={formData.color} isEdit={isEditMode} onChange={handleInputChange} />
              <BioField label="Microchip ID" name="microchipId" value={formData.microchipId} isEdit={isEditMode} onChange={handleInputChange} />
            </CardContent>
          </Card>

          {/* Allergies Card */}
          <Card className="rounded-2xl shadow-sm overflow-hidden border-slate-200">
            <CardHeader className="bg-red-50/50 border-b border-red-100 flex flex-row items-center justify-between py-3 dark:bg-[#2a1517] dark:border-[#7f1d1d]">
              <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#991b1b] dark:text-[#ef4444]">
                <AlertCircle className="h-4 w-4 text-[#991b1b] dark:text-[#ef4444]" />
                Critical Allergies
              </CardTitle>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setShowAddAllergy(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {allergies.map((allergy) => (
                  <div key={allergy.id} className="group relative bg-white p-4 rounded-xl border border-red-50 shadow-sm transition-all hover:border-red-200">
                    <p className="font-black text-red-600 text-sm uppercase tracking-tight">{allergy.allergen}</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium italic">{allergy.severity} Reaction</p>
                    <Button 
                      onClick={() => handleDeleteAllergy(allergy.id)}
                      variant="ghost" 
                      className="absolute top-2 right-2 h-7 w-7 p-0 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {allergies.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4 italic">No allergies recorded.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Immunization Records */}
        <div className="lg:col-span-2 space-y-8">
          <VaccinationRecordsPanel
            vaccinations={vaccinations}
            isLoading={isMedicalLoading}
            onAdd={() => setShowAddVax(true)}
            onDelete={handleDeleteVaccination}
            canEdit
          />
          <PrescriptionDocumentsPanel documents={prescriptionDocuments} />
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={showAddVax} onOpenChange={setShowAddVax}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Vaccination Record</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vaccine Name *</Label>
              <Input value={newVax.name} onChange={e => setNewVax({...newVax, name: e.target.value})} placeholder="e.g. 5-in-1, Anti-Rabies" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date Administered *</Label>
                <Input type="date" value={newVax.date} onChange={e => setNewVax({...newVax, date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Booster Due Date *</Label>
                <Input type="date" value={newVax.nextDue} onChange={e => setNewVax({...newVax, nextDue: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Administrator / Veterinarian</Label>
              <Input value={newVax.applicator} onChange={e => setNewVax({...newVax, applicator: e.target.value})} placeholder="Dr. Name" />
            </div>
            <div className="space-y-2">
              <Label>Veterinarian License Number</Label>
              <Input value={newVax.veterinarianLicense} onChange={e => setNewVax({...newVax, veterinarianLicense: e.target.value})} placeholder="PRC license number" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={newVax.notes} onChange={e => setNewVax({...newVax, notes: e.target.value})} placeholder="Reaction notes, batch details, or reminders" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddVax(false)}>Cancel</Button>
            <Button onClick={handleAddVaccination} className="bg-blue-600">Save Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddAllergy} onOpenChange={setShowAddAllergy}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Allergy Record</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Allergen *</Label>
              <Input value={newAllergy.allergen} onChange={e => setNewAllergy({...newAllergy, allergen: e.target.value})} placeholder="e.g. Chicken, Penicillin" />
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={newAllergy.severity} onValueChange={v => setNewAllergy({...newAllergy, severity: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mild">Mild</SelectItem>
                  <SelectItem value="Moderate">Moderate</SelectItem>
                  <SelectItem value="Severe">Severe</SelectItem>
                  <SelectItem value="Anaphylactic">Anaphylactic</SelectItem>
                  <SelectItem value="Known">Known</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAllergy(false)}>Cancel</Button>
            <Button onClick={handleAddAllergy} className="bg-blue-600">Add Allergy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VaccinationRecordsPanel({ vaccinations, isLoading, onAdd, onDelete, canEdit = false }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex flex-col gap-3 border-b border-blue-100 bg-blue-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <CardTitle className="flex items-center gap-3 text-lg font-black text-slate-800">
          <Syringe className="h-5 w-5 text-[#155dfc]" />
          Vaccination Records
        </CardTitle>
        {canEdit && (
          <Button onClick={onAdd} className="h-10 w-full rounded-xl bg-[#155dfc] px-4 font-bold shadow-md hover:bg-blue-700 sm:w-auto">
            <Plus className="h-4 w-4 mr-2" /> Add Record
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">
            <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin" />
            Loading records...
          </div>
        ) : vaccinations.length > 0 ? (
          <div>
            <div className={`hidden gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-500 md:grid ${
              canEdit
                ? 'grid-cols-[minmax(0,1.15fr)_0.85fr_0.85fr_minmax(0,1fr)_0.7fr_3rem]'
                : 'grid-cols-[minmax(0,1.15fr)_0.85fr_0.85fr_minmax(0,1fr)_0.7fr]'
            }`}>
              <span>Vaccine</span>
              <span>Date Given</span>
              <span>Next Due</span>
              <span>Veterinarian</span>
              <span>Status</span>
              {canEdit && <span className="text-right">Action</span>}
            </div>
            {vaccinations.map((vax) => (
              <VaccinationRow key={vax.id} vax={vax} canEdit={canEdit} onDelete={onDelete} />
            ))}
          </div>
        ) : (
          <div className="px-4 py-12 text-center">
            <Syringe className="mx-auto mb-4 h-10 w-10 text-slate-200" />
            <p className="font-medium text-slate-400">No vaccination records for this pet.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PrescriptionDocumentsPanel({ documents }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-blue-100 bg-blue-50/50 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-3 text-lg font-black text-slate-800">
            <FileText className="h-6 w-6 text-[#155dfc]" />
            Prescription Documents
          </CardTitle>
          <Badge className="w-fit border-0 bg-blue-50 text-blue-700">{documents.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        {documents.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {documents.map((document) => {
              const url = resolveImageUrl(document.url || document.relativeUrl);

              return (
                <a
                  key={document.id || document.url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white text-[#155dfc]">
                    <FileText className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-slate-900">{document.name || 'Prescription document'}</span>
                    <span className="block text-xs font-semibold text-slate-500">
                      {formatDisplayDate(document.createdAt)}
                    </span>
                  </span>
                </a>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-400">
            No prescription documents saved.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function VaccinationRow({ vax, canEdit, onDelete }) {
  return (
    <div className={`grid gap-3 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0 md:items-center md:px-5 ${
      canEdit
        ? 'md:grid-cols-[minmax(0,1.15fr)_0.85fr_0.85fr_minmax(0,1fr)_0.7fr_3rem]'
        : 'md:grid-cols-[minmax(0,1.15fr)_0.85fr_0.85fr_minmax(0,1fr)_0.7fr]'
    }`}>
      <VaccinationCell label="Vaccine" value={vax.name || 'Unnamed vaccine'} strong />
      <VaccinationCell label="Date Given" value={formatDisplayDate(vax.date)} />
      <VaccinationCell label="Next Due" value={formatDisplayDate(vax.nextDue)} highlight />
      <VaccinationCell label="Veterinarian" value={vax.applicator || vax.veterinarianName || vax.veterinarian || 'N/A'} />
      <div className="flex items-center justify-between gap-3 md:block">
        <span className="text-xs font-black uppercase tracking-widest text-slate-400 md:hidden">Status</span>
        <Badge className={`w-fit border-0 ${
          vax.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {vax.status || 'completed'}
        </Badge>
      </div>
      {canEdit && (
        <Button
          onClick={() => onDelete(vax.id)}
          variant="ghost"
          className="h-9 justify-self-start text-red-600 hover:bg-red-50 hover:text-red-700 md:justify-self-end"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function VaccinationCell({ label, value, strong = false, highlight = false }) {
  return (
    <div className="flex items-start justify-between gap-3 md:block">
      <span className="shrink-0 text-xs font-black uppercase tracking-widest text-slate-400 md:hidden">{label}</span>
      <span className={`min-w-0 break-words text-right md:text-left ${strong ? 'font-black text-slate-900' : 'font-semibold'} ${highlight ? 'text-[#155dfc]' : 'text-slate-700'}`}>
        {value || 'N/A'}
      </span>
    </div>
  );
}

function BioField({ label, value, isEdit, name, onChange, type = "text", isSelect = false, options = [], onSelect }) {
  return (
    <div className="flex flex-col gap-1.5 py-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      {isEdit ? (
        isSelect ? (
          <Select value={value} onValueChange={onSelect}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.map(opt => <SelectItem key={options.indexOf(opt)} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input type={type} name={name} value={value || ""} onChange={onChange} className="h-9" />
        )
      ) : (
        <span className="min-w-0 break-words font-bold text-slate-900">
          {value ? (type === "date" ? formatDisplayDate(value) : value) : <span className="text-slate-300 font-normal">N/A</span>}
        </span>
      )}
    </div>
  );
}
