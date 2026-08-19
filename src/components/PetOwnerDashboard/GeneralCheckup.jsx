import { useNavigate } from "../dashboardRouter.jsx";
import { toast } from "../../reusecomponent/toast.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { ArrowLeft, Stethoscope } from "lucide-react";
import { useState, useEffect } from "react";
import { DECEASED_PET_BOOKING_MESSAGE, getPetSelectLabel, isPetDeceased } from "../../lib/petStatus";
import { createBooking } from "../../services/bookingService";
import { fetchUserPets } from "../../services/petService";
import { uploadImageFile } from "../../services/uploadService";
import SubmissionStatus from "../shared/SubmissionStatus";
import FileUploadDropzone from "../shared/FileUploadDropzone";
import { useBookingPriceProjections } from "../../hooks/useBookingPriceProjections";
import { ServiceProjectionDetails, ServiceProjectionNote } from "./ServiceProjectionDetails";
import BookingTimeSlotField from "../shared/BookingTimeSlotField";
import BranchBookingSelect from "../shared/BranchBookingSelect";
import { readBookingAvailabilitySelection } from "../../lib/bookingAvailabilityNavigation.js";

const DEFAULT_BOOKING_CONFIG = {
  availabilityKey: 'general-checkup',
  serviceType: 'General Check-up',
  title: 'General Check-up',
  description: 'Book a comprehensive health examination for your pet',
  notesPlaceholder: 'Any specific concerns or symptoms?',
  projectionKey: 'generalConsultation',
  Icon: Stethoscope,
  branchSelectable: false,
};

export default function GeneralCheckup({ bookingConfig = DEFAULT_BOOKING_CONFIG }) {
  const navigate = useNavigate();
  const config = { ...DEFAULT_BOOKING_CONFIG, ...bookingConfig };
  const BookingIcon = config.Icon;
  const { config: priceProjectionConfig } = useBookingPriceProjections();
  const { instructions, serviceDetails, servicePrices } = priceProjectionConfig;
  const serviceDetail = config.projectionKey ? serviceDetails[config.projectionKey] : null;
  const [pets, setPets] = useState([]);
  const [isLoadingPets, setIsLoadingPets] = useState(true);
  const [isNewPet, setIsNewPet] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(() => {
    const prefill = readBookingAvailabilitySelection(config.availabilityKey);
    return ({
    petId: "",
    petName: "",
    newPetSpecies: "",
    newPetBreed: "",
    newPetAge: "",
    newPetWeight: "",
    date: prefill?.date || "",
    time: prefill?.time || "",
    branchId: prefill?.branchId ? String(prefill.branchId) : "",
    notes: "",
    files: [],
    });
  });

  useEffect(() => {
    const fetchPets = async () => {
      try {
        const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const userId = currentUser.id || currentUser.user_id; 
        
        console.log("Current User from localStorage:", currentUser);
        console.log("Extracted User ID:", userId);

        if (!userId) {
          console.warn("No User ID found, skipping pet fetch.");
          setIsLoadingPets(false);
          return;
        }

        const data = await fetchUserPets(userId);
        console.log("Fetched Pets Data:", data);
        setPets(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error during fetchPets:", error);
        toast.error("Failed to load your pets");
      } finally {
        setIsLoadingPets(false);
      }
    };

    fetchPets();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }

    if ((config.branchSelectable && !formData.branchId) || !formData.date || !formData.time) {
      toast.error(config.branchSelectable
        ? "Select a clinic location and an available appointment date and time."
        : "Select an available appointment date and time.");
      return;
    }
    
    if (!isNewPet && !formData.petId) {
      toast.error("Please select a pet");
      return;
    }

    if (isNewPet && !formData.petName) {
      toast.error("Please enter the pet's name");
      return;
    }

    const selectedRegisteredPet = !isNewPet
      ? pets.find(p => p.db_id?.toString() === formData.petId)
      : null;

    if (isPetDeceased(selectedRegisteredPet)) {
      toast.error(DECEASED_PET_BOOKING_MESSAGE);
      return;
    }

    setIsSubmitting(true);
    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const userId = currentUser.user_id || currentUser.id;

      if (!userId) {
        toast.error("Please log in to book an appointment");
        return;
      }

      // 1. Upload all files if any
      let uploadedFileUrls = [];
      if (formData.files.length > 0) {
        toast.success("Uploading documents...");
        for (const file of formData.files) {
          try {
            const uploadedUrl = await uploadImageFile(file, 'booking_concern');
            if (uploadedUrl) {
              uploadedFileUrls.push(uploadedUrl);
            }
          } catch (uploadError) {
            console.error("Document upload failed:", uploadError);
          }
        }
      }

      // 2. Prepare booking data matching the new schema
      const bookingPayload = {
        user_id: userId,
        pet_id: isNewPet ? 0 : formData.petId, 
        service_type: config.serviceType,
        branch_id: config.branchSelectable && formData.branchId ? Number(formData.branchId) : null,
        booking_date: formData.date,
        booking_time: formData.time,
        notes: formData.notes,
        Image_Booking_Concern_Path: uploadedFileUrls.join(','),
        registered_status: isNewPet ? 'Not Registered' : 'Registered',
        petType: isNewPet ? formData.newPetSpecies : (selectedRegisteredPet?.species || ''),
        new_pet_name: formData.petName,
        new_pet_breed: formData.newPetBreed,
        new_pet_age: formData.newPetAge,
        new_pet_weight: formData.newPetWeight
      };

      console.log("Submitting booking payload:", bookingPayload);
      
      await createBooking(bookingPayload);

      toast.success("Booking submitted! Awaiting admin approval.");
      navigate("/dashboard/services");
    } catch (error) {
      console.error("Booking error:", error);
      toast.error(error.message || "Failed to submit booking");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (files) => {
    const newFiles = Array.from(files || []);
    if (newFiles.length === 0) return;

    setFormData(prev => ({
      ...prev,
      files: [...prev.files, ...newFiles]
    }));
  };

  const removeFile = (index) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  };

  const handlePetChange = (value) => {
    if (value === "new-pet") {
      setIsNewPet(true);
      setFormData(prev => ({ ...prev, petId: "new-pet", petName: "" }));
    } else {
      setIsNewPet(false);
      const selectedPet = pets.find(p => p.db_id?.toString() === value);
      if (isPetDeceased(selectedPet)) {
        toast.error(DECEASED_PET_BOOKING_MESSAGE);
        return;
      }
      setFormData(prev => ({ 
        ...prev, 
        petId: value, 
        petName: selectedPet ? selectedPet.name : "" 
      }));
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Button variant="ghost" onClick={() => navigate("/dashboard/services")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{config.title}</h1>
          <p className="text-gray-600 mt-1">{config.description}</p>
        </div>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        {/* Booking Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
            <CardDescription>Fill in the information below to schedule your appointment</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="petSelect">Select Pet *</Label>
                <Select value={formData.petId} onValueChange={handlePetChange}>
                  <SelectTrigger id="petSelect">
                    <SelectValue 
                      placeholder={isLoadingPets ? "Loading pets..." : "Choose your pet"} 
                      displayValue={
                        formData.petId === "new-pet" 
                          ? "🐾 New Pet (Not Registered)" 
                          : pets.find(p => p.db_id?.toString() === formData.petId)?.name
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {pets.map((pet) => (
                      <SelectItem key={pet.db_id} value={pet.db_id?.toString()} disabled={isPetDeceased(pet)}>
                        {getPetSelectLabel(pet)}
                      </SelectItem>
                    ))}
                    <SelectItem value="new-pet">
                      🐾 New Pet (Not Registered)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isNewPet && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200 animate-in fade-in slide-in-from-top-2 duration-300">
                  <h3 className="font-semibold text-blue-900">New Pet Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="petName">Pet Name *</Label>
                      <Input
                        id="petName"
                        placeholder="e.g., Buddy"
                        restriction="name"
                        required={isNewPet}
                        value={formData.petName}
                        onChange={(e) => setFormData({ ...formData, petName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPetSpecies">Species *</Label>
                      <Select 
                        value={formData.newPetSpecies} 
                        onValueChange={(value) => setFormData({ ...formData, newPetSpecies: value })}
                      >
                        <SelectTrigger id="newPetSpecies">
                          <SelectValue placeholder="Select species" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dog">Dog</SelectItem>
                          <SelectItem value="Cat">Cat</SelectItem>
                          <SelectItem value="Bird">Bird</SelectItem>
                          <SelectItem value="Rabbit">Rabbit</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPetBreed">Breed *</Label>
                      <Input
                        id="newPetBreed"
                        placeholder="e.g., Golden Retriever"
                        restriction="name"
                        required={isNewPet}
                        value={formData.newPetBreed}
                        onChange={(e) => setFormData({ ...formData, newPetBreed: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPetAge">Age *</Label>
                      <Input
                        id="newPetAge"
                        placeholder="e.g., 2"
                        restriction="integer"
                        required={isNewPet}
                        value={formData.newPetAge}
                        onChange={(e) => setFormData({ ...formData, newPetAge: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="newPetWeight">Weight (Optional)</Label>
                      <Input
                        id="newPetWeight"
                        placeholder="e.g., 25.5"
                        restriction="decimal"
                        value={formData.newPetWeight}
                        onChange={(e) => setFormData({ ...formData, newPetWeight: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {config.branchSelectable && (
                <BranchBookingSelect
                  service={config.availabilityKey}
                  date={formData.date}
                  value={formData.branchId}
                  onChange={(branchId) => setFormData((current) => ({ ...current, branchId }))}
                />
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date">Preferred Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <BookingTimeSlotField
                  id="time"
                  service={config.availabilityKey}
                  date={formData.date}
                  branchId={formData.branchId}
                  value={formData.time}
                  onChange={(time) => setFormData((current) => ({ ...current, time }))}
                  label="Preferred time"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder={config.notesPlaceholder}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="files">Upload Files (optional)</Label>
                <FileUploadDropzone
                  id="files"
                  accept="image/*,.pdf"
                  multiple
                  files={formData.files}
                  onFilesSelected={handleFileChange}
                  onRemove={removeFile}
                  label="Click to upload or drag and drop"
                  helper="Images or PDF documents up to 8 MB each"
                />
                <p className="text-xs text-gray-500">Upload medical records, X-rays, or other relevant documents (Maximum upload of 5 files recommended)</p>
              </div>

              <SubmissionStatus active={isSubmitting} label="Submitting booking..." slowLabel="Still submitting booking..." />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Submitting Booking..." : "Submit Booking Request"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Service Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookingIcon className="h-8 w-8" />
              </div>
              <CardTitle className="text-center">{config.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {config.projectionKey ? (
                <ServiceProjectionDetails detail={serviceDetail}>
                  <p className="text-lg font-bold text-blue-600">{servicePrices[config.projectionKey]}</p>
                  {instructions[config.projectionKey] && (
                    <p className="mt-1 text-xs text-gray-500">{instructions[config.projectionKey]}</p>
                  )}
                </ServiceProjectionDetails>
              ) : (
                <p className="text-sm leading-6 text-slate-600">
                  {config.infoText || 'The clinic will review the requested tests and confirm any preparation and fees.'}
                </p>
              )}
            </CardContent>
          </Card>

          {config.projectionKey && <ServiceProjectionNote detail={serviceDetail} />}
        </div>
      </div>
    </div>
  );
}

