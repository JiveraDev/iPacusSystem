import { useState, useCallback } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import {
    PawPrint,
    FileText,
    Plus,
    Copy,
    CheckCircle2,
    ListTodo,
    Camera,
    Loader2,
    Link2,
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../../ui/dialog";
import { addPetService } from '../../services/addPet';
import { calculateAge } from '../../lib/date';
import { toast } from "../../reusecomponent/toast.jsx";
import { useNavigate } from "../dashboardRouter.jsx";
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import DashboardPageHeader from '../shared/DashboardPageHeader.jsx';
import { fetchAllPets, updatePetStatus } from '../../services/petService';
import { uploadImageFile } from '../../services/uploadService';

const QUEUE_REGISTRATION_HANDOFF_KEY = 'ipawcus-queue-registration-handoff';

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
    const [registeredPetQueueHandoff, setRegisteredPetQueueHandoff] = useState(null);

    const fetchPets = useCallback(async () => {
        try {
            const data = await fetchAllPets();
            setRegisteredPets(data);
        } catch (error) {
            console.error('Failed to fetch pets:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useAutoRefresh(fetchPets, { refreshKey: 'pet-register' });

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
        const currentPet = registeredPets.find((pet) => String(pet.id) === String(petId));
        if (!currentPet || currentPet.status === newStatus) {
            return;
        }
        try {
            const response = await updatePetStatus(petId, { status: newStatus });
            setRegisteredPets(prev => prev.map(pet => 
                pet.id === petId ? { ...pet, status: newStatus } : pet
            ));
            if (!response?.unchanged) {
                toast.success(`Pet status updated to ${newStatus}.`);
            }
        } catch (error) {
            console.error('Failed to update status:', error);
            toast.error('The pet status could not be updated. Please try again.');
        }
    };

    const openPetDirectoryProfile = (petId) => {
        navigate(`/dashboard/my-pets/${petId}`);
    };

    const handlePetShortcutKeyDown = (event, petId) => {
        if (event.target !== event.currentTarget) return;

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPetDirectoryProfile(petId);
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
                profileImageUrl = await uploadImageFile(formData.profileImage, 'pet');
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
            
            toast.success('Pet registered. The Pet ID is ready to share.');
            setRegisteredPetName(formData.petName);
            setGeneratedPetId(result.sharableId);
            setRegisteredPetQueueHandoff({
                petId: Number.isFinite(registeredPetId) && registeredPetId > 0 ? registeredPetId : null,
                petName: formData.petName,
                petStatus: formData.status,
                complaint: complaintFromMedicalInfo,
            });
            setFormData({ ...emptyPetProfile });
            setShowSuccessDialog(true);
            fetchPets(); 
        } catch (error) {
            toast.error(error?.message || 'The pet could not be registered. Review the details and try again.');
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
            toast.success('Pet ID copied to the clipboard.');
            setTimeout(() => setCopiedPetId(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            textArea.remove();
            // Fallback: show toast with the ID
            toast.success(`Pet ID: ${generatedPetId}`);
        }
    };

    const handleAddRegisteredPetToQueue = () => {
        const petId = Number(registeredPetQueueHandoff?.petId);
        const petStatus = String(registeredPetQueueHandoff?.petStatus || '').trim().toLowerCase();
        if (!Number.isFinite(petId) || petId <= 0) {
            toast.error('The registered pet could not be prepared for Queue Management.');
            return;
        }
        if (['deceased', 'dead', 'closed', 'done', 'completed'].includes(petStatus)) {
            toast.error('Closed, completed, or deceased pet records cannot be added to the queue.');
            return;
        }

        sessionStorage.setItem(QUEUE_REGISTRATION_HANDOFF_KEY, JSON.stringify({
            petId,
            petName: registeredPetQueueHandoff.petName || registeredPetName,
            complaint: registeredPetQueueHandoff.complaint || '',
        }));
        setShowSuccessDialog(false);
        setCopiedPetId(false);
        navigate('/dashboard/queue');
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
            <DashboardPageHeader
                icon={PawPrint}
                title="Register New Pet"
                description="Complete pet profiling and registration."
                petHover
                petKind="bunny"
                petAccent="sun"
            />

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
                                        restriction="name"
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
                                        restriction="name"
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
                                        placeholder="e.g., 5"
                                        restriction="integer"
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
                                        placeholder="e.g., 15.5"
                                        restriction="decimal"
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
                                        onChange={(e) => handleInputChange('microchipNumber', e.target.value.replace(/\D/g, '').slice(0, 15))}
                                        placeholder="Up to 15 digits"
                                        restriction="digits"
                                        inputMode="numeric"
                                        maxLength={15}
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

                        {/* Owner Section */}
                        <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[14px] p-6 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <PawPrint className="size-5 text-[#155dfc]" />
                                <h3 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#0a0a0a]">
                                    Owner
                                </h3>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#0a0a0a] block mb-2">
                                        Owner Name
                                    </label>
                                    <Input
                                        value={formData.tempOwnerName}
                                        onChange={(e) => handleInputChange('tempOwnerName', e.target.value)}
                                        restriction="name"
                                        placeholder="Enter owner name"
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
                                        placeholder="Current medications"
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
                                        placeholder="Medical history"
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
                                        placeholder="Additional notes"
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
                                role="button"
                                tabIndex={0}
                                title="Open pet directory profile"
                                onClick={() => openPetDirectoryProfile(pet.id)}
                                onKeyDown={(event) => handlePetShortcutKeyDown(event, pet.id)}
                                className={`cursor-pointer rounded-[12px] border p-4 transition hover:shadow-md ${
                                    pet.status === 'Emergency'
                                        ? 'border-red-100 bg-red-50 hover:bg-red-100'
                                        : pet.status === 'Deceased'
                                        ? 'border-slate-200 bg-slate-100 opacity-75 hover:bg-slate-200'
                                        : 'border-slate-100 bg-white hover:bg-slate-50'
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

                                <div className="mt-4" onClick={(event) => event.stopPropagation()}>
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
                        </colgroup>
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="py-3 px-4 font-['Arimo:Bold',sans-serif] text-[14px] text-slate-500">Pet ID</th>
                                <th className="py-3 px-4 font-['Arimo:Bold',sans-serif] text-[14px] text-slate-500">Pet Name</th>
                                <th className="py-3 px-4 font-['Arimo:Bold',sans-serif] text-[14px] text-slate-500 hidden lg:table-cell">Species/Breed</th>
                                <th className="py-3 px-4 font-['Arimo:Bold',sans-serif] text-[14px] text-slate-500 hidden xl:table-cell">Gender/Age</th>
                                <th className="py-3 px-4 font-['Arimo:Bold',sans-serif] text-[14px] text-slate-500 hidden lg:table-cell">Owner</th>
                                <th className="py-3 px-4 font-['Arimo:Bold',sans-serif] text-[14px] text-slate-500">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="py-10 text-center text-slate-400">
                                        Loading pets...
                                    </td>
                                </tr>
                            ) : filteredRegisteredPets.length > 0 ? (
                                filteredRegisteredPets
                                    .map((pet) => (
                                        <tr 
                                            key={pet.id} 
                                            role="button"
                                            tabIndex={0}
                                            title="Open pet directory profile"
                                            onClick={() => openPetDirectoryProfile(pet.id)}
                                            onKeyDown={(event) => handlePetShortcutKeyDown(event, pet.id)}
                                            className={`cursor-pointer border-b transition ${
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
                                        <td className="py-3 px-4" onClick={(event) => event.stopPropagation()}>
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
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="py-10 text-center text-slate-400">
                                        No pets registered yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Success Dialog */}
            <Dialog
                open={showSuccessDialog}
                onOpenChange={(open) => {
                    setShowSuccessDialog(open);
                    if (!open) setCopiedPetId(false);
                }}
            >
                <DialogContent className="w-[calc(100%_-_1rem)] max-w-[640px] overflow-hidden border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:w-[calc(100%_-_2rem)]">
                    <div className="border-b border-slate-200 px-4 py-5 dark:border-slate-700 sm:px-6">
                        <DialogHeader className="mb-0 pr-10">
                            <div className="flex items-start gap-3.5">
                                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                                    <CheckCircle2 className="size-6" strokeWidth={2.5} />
                                </div>
                                <div className="min-w-0">
                                    <DialogTitle className="text-xl font-black text-slate-950 dark:text-white sm:text-2xl">
                                        Registration complete
                                    </DialogTitle>
                                    <DialogDescription className="mt-1 max-w-lg text-sm leading-5 text-slate-600 dark:text-slate-300">
                                        The patient profile is saved. Copy the Pet ID so the owner can securely link this profile.
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <div className="space-y-4 px-4 py-5 sm:px-6">
                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/70">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-[#155dfc] dark:bg-blue-950/70 dark:text-blue-300">
                                <PawPrint className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Registered pet</p>
                                <p className="truncate text-base font-black text-slate-950 dark:text-white">{registeredPetName}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                                Registered
                            </span>
                        </div>

                        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 dark:border-blue-900 dark:bg-blue-950/30">
                            <ListTodo className="mt-0.5 size-5 shrink-0 text-[#155dfc] dark:text-blue-300" />
                            <div>
                                <p className="text-sm font-black text-slate-950 dark:text-white">
                                    Not added to the queue yet
                                </p>
                                <p className="mt-0.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
                                    Choose Add to queue below to open Queue Management, select the service, and review the visit details. Choosing Done only closes this message.
                                </p>
                            </div>
                        </div>

                        <section className="rounded-xl border-2 border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30" aria-labelledby="shareable-pet-id-label">
                            <div className="mb-3">
                                <h3 id="shareable-pet-id-label" className="flex items-center gap-2 text-sm font-black text-slate-950 dark:text-white">
                                    <Link2 className="size-4 text-[#155dfc] dark:text-blue-300" />
                                    Owner linking Pet ID
                                </h3>
                                <p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                                    The owner will enter this ID from the Link Pet screen.
                                </p>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                                <div className="flex min-h-11 min-w-0 items-center justify-center rounded-lg border border-blue-200 bg-white px-3 dark:border-blue-800 dark:bg-slate-900">
                                    <code className="max-w-full break-all text-center text-lg font-black tracking-wider text-[#155dfc] dark:text-blue-300 sm:text-xl">
                                        {generatedPetId}
                                    </code>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCopyPetId}
                                    disabled={!generatedPetId}
                                    className={`w-full gap-2 sm:w-auto ${
                                        copiedPetId
                                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                            : 'border-blue-200 text-[#155dfc] hover:bg-blue-100 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950/60'
                                    }`}
                                    aria-live="polite"
                                >
                                    {copiedPetId ? <CheckCircle2 /> : <Copy />}
                                    {copiedPetId ? 'Copied' : 'Copy Pet ID'}
                                </Button>
                            </div>
                        </section>

                        <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700" aria-labelledby="owner-linking-instructions">
                            <div className="mb-3 flex items-center gap-2">
                                <ListTodo className="size-4 text-slate-500 dark:text-slate-400" />
                                <h3 id="owner-linking-instructions" className="text-sm font-black text-slate-950 dark:text-white">
                                    What the owner needs to do
                                </h3>
                            </div>
                            <ol className="grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                                <li className="flex gap-2.5">
                                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">1</span>
                                    <span>Sign in to the owner account and open <strong className="font-bold text-slate-800 dark:text-slate-100">Pets</strong>.</span>
                                </li>
                                <li className="flex gap-2.5">
                                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">2</span>
                                    <span>Select <strong className="font-bold text-slate-800 dark:text-slate-100">Link Pet</strong> and enter the Pet ID shown above.</span>
                                </li>
                                <li className="flex gap-2.5">
                                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">3</span>
                                    <span>Confirm the pet details to finish linking the profile.</span>
                                </li>
                            </ol>
                        </section>
                    </div>

                    <DialogFooter className="m-0 border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/50 sm:px-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleAddRegisteredPetToQueue}
                            disabled={
                                !registeredPetQueueHandoff?.petId
                                || ['deceased', 'dead', 'closed', 'done', 'completed'].includes(
                                    String(registeredPetQueueHandoff?.petStatus || '').trim().toLowerCase()
                                )
                            }
                            className="w-full gap-2 border-[#155dfc] text-[#155dfc] hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950/50 sm:w-auto"
                        >
                            <ListTodo className="size-4" />
                            Add to queue
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                setShowSuccessDialog(false);
                                setCopiedPetId(false);
                            }}
                            className="w-full bg-[#155dfc] text-white hover:bg-[#0d4acf] sm:w-auto sm:min-w-28"
                        >
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
