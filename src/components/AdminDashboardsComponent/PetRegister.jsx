import { useState, useEffect, useCallback } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { PawPrint, FileText, Plus, Copy, CheckCircle2, ListTodo, Camera, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "../../ui/dialog";
import { addPetService } from '../../services/addPet';
import { calculateAge } from '../../lib/date';
import { toast } from "../../reusecomponent/toast.jsx";
import { useNavigate } from "../dashboardRouter.jsx";

const emptyPetProfile = {
    id: '',
    petName: '',
    species: '',
    breed: '',
    birthDate: '',
    age: '',
    gender: '',
    weight: '',
    colorMarkings: '',
    microchipNumber: '',
    tempOwnerName: '',
    status: 'Healthy',
    allergies: '',
    medications: '',
    medicalHistory: '',
    lastVisit: '',
    vetNotes: '',
    profileImage: null,
    imagePreview: null
};

export default function PetRegister() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState(emptyPetProfile);
    const [registeredPets, setRegisteredPets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Dialog and Pet ID states
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const [generatedPetId, setGeneratedPetId] = useState('');
    const [copiedPetId, setCopiedPetId] = useState(false);
    const [registeredPetName, setRegisteredPetName] = useState('');
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

    const fetchPets = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/pet_information`);
            if (response.ok) {
                const data = await response.json();
                setRegisteredPets(data);
            }
        } catch (error) {
            console.error('Failed to fetch pets:', error);
        } finally {
            setIsLoading(false);
        }
    }, [API_BASE_URL]);

    useEffect(() => {
        fetchPets();
    }, [fetchPets]);

    const handleInputChange = (field, value) => {
        setFormData(prev => {
            const newData = { ...prev, [field]: value };
            if (field === 'birthDate') {
                newData.age = calculateAge(value);
            }
            return newData;
        });
    };

    const handleStatusChange = async (petId, newStatus) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/pet_information/${petId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            
            if (response.ok) {
                setRegisteredPets(prev => prev.map(pet => 
                    pet.id === petId ? { ...pet, status: newStatus } : pet
                ));
                toast.success(`Pet status updated to ${newStatus}`);
            } else {
                throw new Error("Failed to update status");
            }
        } catch (error) {
            console.error('Failed to update status:', error);
            toast.error("Error updating pet status");
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({
                ...prev,
                profileImage: file,
                imagePreview: URL.createObjectURL(file)
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        let profileImageUrl = "";
        const complaintFromMedicalInfo = [
            `Medical Information:`,
            `Known Allergies: ${formData.allergies || 'N/A'}`,
            `Current Medications: ${formData.medications || 'N/A'}`,
            `Medical History: ${formData.medicalHistory || 'N/A'}`,
            `Last Visit Date: ${formData.lastVisit || 'N/A'}`,
            `Veterinary Notes: ${formData.vetNotes || 'N/A'}`
        ].join('\n');

        try {
            // 1. Upload image if exists
            if (formData.profileImage) {
                setIsUploading(true);
                const uploadData = new FormData();
                uploadData.append('image', formData.profileImage);
                uploadData.append('type', 'pet');
                
                const uploadRes = await fetch(`${API_BASE_URL}/api/upload`, {
                    method: 'POST',
                    body: uploadData
                });

                if (!uploadRes.ok) throw new Error("Failed to upload image");
                const uploadResult = await uploadRes.json();
                profileImageUrl = uploadResult.url;
            }

            // 2. Submit pet data
            const petPayload = {
                petName: formData.petName,
                species: formData.species,
                breed: formData.breed,
                birthDate: formData.birthDate,
                status: formData.status,
                age: formData.age || null,
                gender: formData.gender,
                weight: formData.weight || 0,
                microchipNumber: formData.microchipNumber || null,
                tempOwnerName: formData.tempOwnerName || null,
                allergies: formData.allergies || null,
                colorMarkings: formData.colorMarkings || null,
                currentMedication: formData.medications || null,
                veterinarianNotes: formData.vetNotes || null,
                lastVisitDate: formData.lastVisit || null,
                profileImage: profileImageUrl
            };

            const result = await addPetService(petPayload);
            const registeredPetId = Number(result?.id);

            // Post newly registered pet into queue as Consultation source=register.
            // If this secondary step fails, keep the successful pet registration intact.
            if (Number.isFinite(registeredPetId) && registeredPetId > 0) {
                try {
                    const queueResponse = await fetch(`${API_BASE_URL}/queues`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            pet_id: registeredPetId,
                            user_id: null,
                            service_name: 'Consultation',
                            priority: 'normal',
                            complaint: complaintFromMedicalInfo,
                            queue_source: 'register'
                        })
                    });
                    if (!queueResponse.ok) {
                        const queueErrorData = await queueResponse.json().catch(() => ({}));
                        throw new Error(queueErrorData.message || 'Queue POST failed');
                    }
                } catch (queueError) {
                    console.error('Failed to auto-add registered pet to queue:', queueError);
                    toast.error('Pet registered, but failed to add to queue automatically.');
                }
            } else {
                toast.error('Pet registered, but missing pet ID for queue auto-add.');
            }
            
            toast.success("Pet registered successfully!");
            setRegisteredPetName(formData.petName);
            setGeneratedPetId(result.sharableId);
            setFormData({ ...emptyPetProfile });
            setShowSuccessDialog(true);
            fetchPets(); 
        } catch (error) {
            toast.error('Failed to register pet: ' + error.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCopyPetId = () => {
        // Fallback method for copying text (works without clipboard permissions)
        const textArea = document.createElement('textarea');
        textArea.value = generatedPetId;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
            textArea.remove();
            setCopiedPetId(true);
            toast.success("Pet ID copied to clipboard!");
            setTimeout(() => setCopiedPetId(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            textArea.remove();
            // Fallback: show toast with the ID
            toast.success(`Pet ID: ${generatedPetId}`);
        }
    };

    const filteredRegisteredPets = registeredPets.filter(pet => {
        const query = searchTerm.toLowerCase();
        const matchesSearch =
            (pet.petName || '').toLowerCase().includes(query) ||
            String(pet.id || '').toLowerCase().includes(query);
        const matchesStatus = statusFilter === 'all' || pet.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h2 className="font-['Arimo:Bold',sans-serif] font-bold text-[24px] text-[#101828] mb-2">
                    Register New Pet
                </h2>
                <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565]">
                    Complete pet profiling and registration
                </p>
            </div>

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {/* Left Column */}
                    <div className="min-w-0 space-y-6">
                        {/* Pet Information Section */}
                        <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[14px] p-6 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <PawPrint className="size-5 text-[#155dfc]" />
                                <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#0a0a0a]">
                                    Pet Information
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="flex flex-col items-center justify-center mb-4 pt-2 sm:col-span-2">
                                    <Label className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#0a0a0a] mb-4 w-full">
                                        Pet Profile Picture
                                    </Label>
                                    <div className="relative group">
                                        <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center transition-all group-hover:border-[#155dfc]">
                                            {formData.imagePreview ? (
                                                <img 
                                                    src={formData.imagePreview} 
                                                    alt="Preview" 
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <PawPrint className="size-12 text-slate-300" />
                                            )}
                                        </div>
                                        <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                                            <div className="flex flex-col items-center text-white text-xs gap-1">
                                                <Camera className="size-6" />
                                                <span>{formData.imagePreview ? "Change" : "Upload"}</span>
                                            </div>
                                            <input 
                                                type="file" 
                                                className="hidden" 
                                                accept="image/*" 
                                                onChange={handleImageChange}
                                            />
                                        </label>
                                    </div>
                                    {isUploading && (
                                        <div className="mt-2 flex items-center gap-2 text-xs text-[#155dfc]">
                                            <Loader2 className="size-3 animate-spin" />
                                            <span>Uploading image...</span>
                                        </div>
                                    )}
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#0a0a0a] block mb-2">
                                        Pet Name *
                                    </label>
                                    <Input
                                        value={formData.petName}
                                        onChange={(e) => handleInputChange('petName', e.target.value)}
                                        placeholder="Enter pet name"
                                        className="h-[40px]"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#0a0a0a] block mb-2">
                                        Species *
                                    </label>
                                    <Select value={formData.species} onValueChange={(value) => handleInputChange('species', value)}>
                                        <SelectTrigger className="h-[40px]">
                                            <SelectValue placeholder="Select species" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Dog">Dog</SelectItem>
                                            <SelectItem value="Cat">Cat</SelectItem>
                                            <SelectItem value="Bird">Bird</SelectItem>
                                            <SelectItem value="Rabbit">Rabbit</SelectItem>
                                            <SelectItem value="Hamster">Hamster</SelectItem>
                                            <SelectItem value="Guinea Pig">Guinea Pig</SelectItem>
                                            <SelectItem value="Reptile">Reptile</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#0a0a0a] block mb-2">
                                        Breed *
                                    </label>
                                    <Input
                                        value={formData.breed}
                                        onChange={(e) => handleInputChange('breed', e.target.value)}
                                        placeholder="Enter breed"
                                        className="h-[40px]"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#0a0a0a] block mb-2">
                                        Birth Date *
                                    </label>
                                    <Input
                                        type="date"
                                        value={formData.birthDate}
                                        onChange={(e) => handleInputChange('birthDate', e.target.value)}
                                        className="h-[40px]"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#0a0a0a] block mb-2">
                                        Age
                                    </label>
                                    <Input
                                        value={formData.age}
                                        onChange={(e) => handleInputChange('age', e.target.value)}
                                        placeholder="e.g., 5 years, 6 months"
                                        className="h-[40px]"
                                    />
                                </div>

                                <div>
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#0a0a0a] block mb-2">
                                        Gender *
                                    </label>
                                    <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                                        <SelectTrigger className="h-[40px]">
                                            <SelectValue placeholder="Select gender" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Male">Male</SelectItem>
                                            <SelectItem value="Female">Female</SelectItem>
                                            <SelectItem value="Neutered Male">Neutered Male</SelectItem>
                                            <SelectItem value="Spayed Female">Spayed Female</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div >
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] flex text-[#0a0a0a] block mb-2">
                                        Weight
                                        <span className="font-['Arimo:Regular',sans-serif] text-[14px]  text-[gray] block ">
                                            &nbsp;(in kg)
                                        </span>
                                    </label>
                                    <Input
                                        value={formData.weight}
                                        onChange={(e) => handleInputChange('weight', e.target.value)}
                                        placeholder="e.g., 15 kg"
                                        className="h-[40px]"
                                    />
                                </div>

                                <div>
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#0a0a0a] block mb-2">
                                        Color/Markings
                                    </label>
                                    <Input
                                        value={formData.colorMarkings}
                                        onChange={(e) => handleInputChange('colorMarkings', e.target.value)}
                                        placeholder="e.g., Brown with white spots"
                                        className="h-[40px]"
                                    />
                                </div>

                                <div>
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#0a0a0a] block mb-2">
                                        Microchip Number (Optional)
                                    </label>
                                    <Input
                                        value={formData.microchipNumber}
                                        onChange={(e) => handleInputChange('microchipNumber', e.target.value)}
                                        placeholder="Enter microchip number"
                                        className="h-[40px]"
                                    />
                                </div>

                                <div>
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#0a0a0a] block mb-2">
                                        Pet Status *
                                    </label>
                                    <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                                        <SelectTrigger className="h-[40px]">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Healthy">Healthy</SelectItem>
                                            <SelectItem value="Emergency">Emergency</SelectItem>
                                            <SelectItem value="Deceased">Deceased</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Temporary Owner Section */}
                        <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[14px] p-6 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <PawPrint className="size-5 text-[#155dfc]" />
                                <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#0a0a0a]">
                                    Temporary Owner
                                </h3>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#0a0a0a] block mb-2">
                                        Temporary Owner Name
                                    </label>
                                    <Input
                                        value={formData.tempOwnerName}
                                        onChange={(e) => handleInputChange('tempOwnerName', e.target.value)}
                                        placeholder="Enter temporary owner name"
                                        className="h-[40px]"
                                    />
                                    <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565] mt-2">
                                        This pet can be linked to an owner account later
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="min-w-0 space-y-6">
                        {/* Medical Information Section */}
                        <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[14px] p-6 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <FileText className="size-5 text-[#155dfc]" />
                                <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#0a0a0a]">
                                    Medical Information
                                </h3>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#0a0a0a] block mb-2">
                                        Known Allergies
                                    </label>
                                    <Textarea
                                        value={formData.allergies}
                                        onChange={(e) => handleInputChange('allergies', e.target.value)}
                                        placeholder="List any known allergies"
                                        className="min-h-[80px]"
                                    />
                                </div>

                                <div>
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#0a0a0a] block mb-2">
                                        Current Medications
                                    </label>
                                    <Textarea
                                        value={formData.medications}
                                        onChange={(e) => handleInputChange('medications', e.target.value)}
                                        placeholder="List current medications and dosages"
                                        className="min-h-[80px]"
                                    />
                                </div>

                                <div>
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#0a0a0a] block mb-2">
                                        Medical History
                                    </label>
                                    <Textarea
                                        value={formData.medicalHistory}
                                        onChange={(e) => handleInputChange('medicalHistory', e.target.value)}
                                        placeholder="Previous illnesses, surgeries, or medical conditions"
                                        className="min-h-[100px]"
                                    />
                                </div>


<hr className="border-[#000]" />
                                <div>
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#0a0a0a] block mb-2">
                                        Last Visit Date
                                    </label>
                                    <Input
                                        type="date"
                                        value={formData.lastVisit}
                                        onChange={(e) => handleInputChange('lastVisit', e.target.value)}
                                        className="h-[40px]"
                                    />
                                </div>

                                <div>
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#0a0a0a] block mb-2">
                                        Veterinary Notes
                                        <span className="font-['Arimo:Regular',sans-serif] text-[14px]  text-[gray] block ">
                                            &nbsp; (Optional coming form other veterinarian)
                                        </span>
                                    </label>
                                    <Textarea
                                        value={formData.vetNotes}
                                        onChange={(e) => handleInputChange('vetNotes', e.target.value)}
                                        placeholder="Additional notes or special instructions"
                                        className="min-h-[100px]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form Actions */}
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFormData({ ...emptyPetProfile })}
                        className="h-[40px] w-full sm:w-[140px]"
                    >
                        Clear Form
                    </Button>
                    <Button
                        type="submit"
                        className="h-[40px] w-full bg-[#155dfc] hover:bg-[#0d4acf] sm:w-[180px]"
                    >
                        <Plus className="size-4 mr-2" />
                        Register Pet
                    </Button>
                </div>
            </form>
            {/* Registered Pets List */}
            <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[14px] p-4 space-y-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <ListTodo className="size-5 text-[#155dfc]" />
                        <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#0a0a0a]">
                            Registered Pets List
                        </h3>
                    </div>
                    
                    <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-[minmax(180px,250px)_140px_auto] sm:items-center">
                        <Input
                            placeholder="Search pet name or ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="h-[36px] w-full"
                        />
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-[36px] w-full">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="Healthy">Healthy</SelectItem>
                                <SelectItem value="Emergency">Emergency</SelectItem>
                                <SelectItem value="Deceased">Deceased</SelectItem>
                            </SelectContent>
                        </Select>
                        <span className="justify-self-start bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap sm:justify-self-auto">
                            Total: {registeredPets.length}
                        </span>
                    </div>
                </div>

                <div className="space-y-3 sm:hidden">
                    {isLoading ? (
                        <div className="rounded-[12px] border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-400">
                            Loading pets...
                        </div>
                    ) : filteredRegisteredPets.length > 0 ? (
                        filteredRegisteredPets.map((pet) => (
                            <div
                                key={pet.id}
                                className={`rounded-[12px] border p-4 ${
                                    pet.status === 'Emergency'
                                        ? 'border-red-100 bg-red-50'
                                        : pet.status === 'Deceased'
                                        ? 'border-slate-200 bg-slate-100 opacity-75'
                                        : 'border-slate-100 bg-white'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <code className="inline-block max-w-full truncate rounded bg-slate-100 px-2 py-1 font-mono text-xs text-[#155dfc]">
                                            {pet.id}
                                        </code>
                                        <p className="mt-2 truncate font-semibold text-slate-900">{pet.petName}</p>
                                    </div>
                                    <div className={`mt-1 size-2 rounded-full shrink-0 ${
                                        pet.status === 'Emergency' ? 'bg-red-500 animate-pulse' :
                                        pet.status === 'Deceased' ? 'bg-slate-400' :
                                        'bg-green-500'
                                    }`} />
                                </div>

                                <div className="mt-4">
                                    <Select
                                        value={pet.status}
                                        onValueChange={(value) => handleStatusChange(pet.id, value)}
                                    >
                                        <SelectTrigger className={`h-[38px] w-full font-medium transition-colors ${
                                            pet.status === 'Emergency'
                                                ? 'border-red-200 bg-white text-red-600'
                                                : pet.status === 'Deceased'
                                                ? 'border-slate-200 bg-white text-slate-500'
                                                : 'border-slate-200 bg-white text-slate-700'
                                        }`}>
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Healthy">Healthy</SelectItem>
                                            <SelectItem value="Emergency">Emergency</SelectItem>
                                            <SelectItem value="Deceased">Deceased</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-[12px] border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-400">
                            No pets registered yet.
                        </div>
                    )}
                </div>

                <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full min-w-[520px] table-fixed text-left border-collapse lg:min-w-[820px] xl:min-w-[960px]">
                        <colgroup>
                            <col className="w-[140px]" />
                            <col className="w-[160px]" />
                            <col className="hidden w-[150px] lg:table-column" />
                            <col className="hidden w-[130px] xl:table-column" />
                            <col className="hidden w-[150px] lg:table-column" />
                            <col className="w-[160px]" />
                            <col className="w-[120px]" />
                        </colgroup>
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="py-3 px-4 font-['Arimo:Bold',sans-serif] text-[14px] text-slate-500">Pet ID</th>
                                <th className="py-3 px-4 font-['Arimo:Bold',sans-serif] text-[14px] text-slate-500">Pet Name</th>
                                <th className="py-3 px-4 font-['Arimo:Bold',sans-serif] text-[14px] text-slate-500 hidden lg:table-cell">Species/Breed</th>
                                <th className="py-3 px-4 font-['Arimo:Bold',sans-serif] text-[14px] text-slate-500 hidden xl:table-cell">Gender/Age</th>
                                <th className="py-3 px-4 font-['Arimo:Bold',sans-serif] text-[14px] text-slate-500 hidden lg:table-cell">Owner</th>
                                <th className="py-3 px-4 font-['Arimo:Bold',sans-serif] text-[14px] text-slate-500">Status</th>
                                <th className="py-3 px-4 font-['Arimo:Bold',sans-serif] text-[14px] text-slate-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan="7" className="py-10 text-center text-slate-400">
                                        Loading pets...
                                    </td>
                                </tr>
                            ) : filteredRegisteredPets.length > 0 ? (
                                filteredRegisteredPets
                                    .map((pet) => (
                                        <tr 
                                            key={pet.id} 
                                            className={`border-b transition ${
                                                pet.status === 'Emergency' 
                                                    ? 'bg-red-50 hover:bg-red-100 border-red-100' 
                                                    : pet.status === 'Deceased'
                                                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 opacity-75'
                                                    : 'border-slate-50 hover:bg-slate-50'
                                            }`}
                                        >
                                        <td className="py-3 px-4">
                                            <code className="inline-block max-w-full truncate rounded bg-slate-100 px-2 py-1 font-mono text-xs text-[#155dfc]">
                                                {pet.id}
                                            </code>
                                        </td>
                                        <td className="py-3 px-4">
                                            <p className="truncate font-semibold text-slate-900">{pet.petName}</p>
                                        </td>
                                        <td className="py-3 px-4 hidden lg:table-cell">
                                            <p className="truncate text-sm text-slate-600">{pet.species}</p>
                                            <p className="truncate text-xs text-slate-400">{pet.breed}</p>
                                        </td>
                                        <td className="py-3 px-4 hidden xl:table-cell">
                                            <p className="truncate text-sm text-slate-600">{pet.gender}</p>
                                            <p className="truncate text-xs text-slate-400">{pet.age}</p>
                                        </td>
                                        <td className="py-3 px-4 hidden lg:table-cell">
                                            <p className="truncate text-sm font-medium text-blue-600">{pet.tempOwnerName || 'Unlinked'}</p>
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`size-2 rounded-full shrink-0 ${
                                                    pet.status === 'Emergency' ? 'bg-red-500 animate-pulse' :
                                                    pet.status === 'Deceased' ? 'bg-slate-400' :
                                                    'bg-green-500'
                                                }`} />
                                                <Select 
                                                    value={pet.status} 
                                                    onValueChange={(value) => handleStatusChange(pet.id, value)}
                                                >
                                                    <SelectTrigger className={`h-[36px] w-[132px] font-medium transition-colors ${
                                                        pet.status === 'Emergency' 
                                                            ? 'border-red-200 bg-white text-red-600' 
                                                            : pet.status === 'Deceased'
                                                            ? 'border-slate-200 bg-white text-slate-500'
                                                            : 'border-slate-200 bg-white text-slate-700'
                                                    }`}>
                                                        <SelectValue placeholder="Select status" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Healthy">Healthy</SelectItem>
                                                        <SelectItem value="Emergency">Emergency</SelectItem>
                                                        <SelectItem value="Deceased">Deceased</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => navigate(`/dashboard/pet-register/${pet.id}`)}
                                                className="h-8 px-3 text-xs font-bold border-[#155dfc] text-[#155dfc] hover:bg-[#155dfc] hover:text-white"
                                            >
                                                Edit Profile
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="7" className="py-10 text-center text-slate-400">
                                        No pets registered yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Success Dialog */}
            <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
                <DialogContent className="sm:max-w-[500px] scroll-auto">
                    <DialogHeader>
                        <DialogTitle className="font-['Arimo:Bold',sans-serif] text-[24px] text-[#0c6a3c] flex items-center gap-2">
                            <CheckCircle2 className="size-7" />
                            Pet Registered Successfully!
                        </DialogTitle>
                        <DialogDescription className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
                            Share the Pet ID below with the owner to link their account.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Pet Info */}
                        <div className="bg-[#e0f2e9] border-2 border-[#0c6a3c] rounded-[12px] p-4 text-center">
                            <PawPrint className="size-12 text-[#0c6a3c] mx-auto mb-2" />
                            <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828]">
                                {registeredPetName} has been registered!
                            </h3>
                        </div>

                        {/* Shareable Pet ID Card */}
                        <div className="bg-gradient-to-br from-[#155dfc] to-[#0d4fd4] rounded-[12px] p-6 text-center">
                            <p className="font-['Arimo:Bold',sans-serif] text-[12px] text-white/80 mb-2 uppercase tracking-wide">
                                Shareable Pet ID
                            </p>
                            <div className="bg-white/10 backdrop-blur rounded-[8px] p-4 mb-4">
                                <p className="font-['Montserrat:Bold',sans-serif] font-bold text-[24px] text-white tracking-wider break-all">
                                    {generatedPetId}
                                </p>
                            </div>
                            <Button
                                onClick={handleCopyPetId}
                                className="bg-white text-[#000]  font-['Arimo:Bold',sans-serif] h-[40px]"
                            >
                                {copiedPetId ? (
                                    <>
                                        <CheckCircle2 className="size-4 mr-2" />
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="size-4 mr-2" />
                                        Copy Pet ID
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Instructions */}
                        <div className="bg-[#f9fafb] border border-[rgba(0,0,0,0.1)] rounded-[12px] p-4">
                            <h4 className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-2">
                                📋 Instructions for Pet Owner
                            </h4>
                            <ol className="space-y-1 font-['Arimo:Regular',sans-serif] text-[13px] text-[#4a5565] list-decimal list-inside">
                                <li>Go to the iPawcus Website</li>
                                <li>Create or log in to your account</li>
                                <li>Navigate to "Link Pet" in Pets section</li>
                                <li>Enter Pet ID: <span className="font-['Arimo:Bold',sans-serif] text-[#155dfc]">{generatedPetId}</span></li>
                                <li>Complete the linking process</li>
                            </ol>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t">
                        <Button
                            onClick={() => {
                                setShowSuccessDialog(false);
                                setCopiedPetId(false);
                            }}
                            className="bg-[#155dfc] hover:bg-[#0d4acf] text-white h-[40px] w-[100px]"
                        >
                            Done
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
