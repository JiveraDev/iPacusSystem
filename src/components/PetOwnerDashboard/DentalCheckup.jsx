import { useNavigate } from "../dashboardRouter.jsx";
import { toast } from "../../reusecomponent/toast.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Heart } from "lucide-react";
import { useState, useEffect } from "react";
import { DECEASED_PET_BOOKING_MESSAGE, getPetSelectLabel, isPetDeceased } from "../../lib/petStatus";
import { createBooking } from "../../services/bookingService";
import { fetchUserPets } from "../../services/petService";
import { uploadImageFile } from "../../services/uploadService";
import SubmissionStatus from "../shared/SubmissionStatus";
import FileUploadDropzone from "../shared/FileUploadDropzone";
import { useBookingPriceProjections } from "../../hooks/useBookingPriceProjections";
import { ServiceProjectionDetails, ServiceProjectionNote } from "./ServiceProjectionDetails";
import { ServiceProjectionEditor } from './ServiceContentEditor.jsx';
import BookingTimeSlotField from "../shared/BookingTimeSlotField";
import { readBookingAvailabilitySelection } from "../../lib/bookingAvailabilityNavigation.js";
import { clinicTodayDate } from "../../lib/date";
import { ServicePageHeader, ServicePageShell, ServiceSummaryCard } from "./ServicePageLayout.jsx";
import { reportBookingFormErrors, reportBookingSubmissionError, standardAppointmentBookingErrors } from "../../lib/bookingFormValidation";

export default function DentalCheckup() {
  const navigate = useNavigate();
  const { config: priceProjectionConfig, saveConfig: savePriceProjectionConfig } = useBookingPriceProjections();
  const { instructions, serviceDetails, servicePrices } = priceProjectionConfig;
  const serviceDetail = serviceDetails.dental;
  const [pets, setPets] = useState([]);
  const [isLoadingPets, setIsLoadingPets] = useState(true);
  const [isNewPet, setIsNewPet] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(() => {
    const prefill = readBookingAvailabilitySelection('dental');
    return ({
    petId: "",
    petName: "",
    newPetSpecies: "",
    newPetBreed: "",
    newPetAge: "",
    newPetWeight: "",
    date: prefill?.date || "",
    time: prefill?.time || "",
    notes: "",
    files: [],
    });
  });

  useEffect(() => {
    const fetchPets = async () => {
      try {
        const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const userId = currentUser.id || currentUser.user_id; 
        
        if (!userId) {
          setIsLoadingPets(false);
          return;
        }

        const data = await fetchUserPets(userId);
        setPets(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching pets:", error);
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

    const validationErrors = standardAppointmentBookingErrors({
      formData,
      isNewPet,
      today: clinicTodayDate(),
    });
    if (reportBookingFormErrors(validationErrors)) {
      return;
    }

    const selectedRegisteredPet = !isNewPet
      ? pets.find(p => p.db_id?.toString() === formData.petId)
      : null;

    if (isPetDeceased(selectedRegisteredPet)) {
      reportBookingFormErrors([{ fieldId: 'petSelect', label: 'Pet', type: 'invalid', message: DECEASED_PET_BOOKING_MESSAGE }]);
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

      // 2. Prepare booking data
      const bookingPayload = {
        user_id: userId,
        pet_id: isNewPet ? 0 : formData.petId, 
        service_type: 'dental',
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

      await createBooking(bookingPayload);

      toast.success("Booking submitted! Awaiting admin approval.");
      navigate("/dashboard/services");
    } catch (error) {
      console.error("Booking error:", error);
      reportBookingSubmissionError(error);
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
    <ServicePageShell>
      <ServicePageHeader
        icon={Heart}
        title="Dental Check-up"
        description="Oral health examination and dental care"
        onBack={() => navigate("/dashboard/services")}
      />

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(18rem,0.8fr)]">
        {/* Booking Form */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
            <CardDescription>Fill in the information below to schedule your appointment</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="ipawcus-dashboard-form space-y-5">
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date">Preferred Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    min={clinicTodayDate()}
                  />
                </div>

                <BookingTimeSlotField
                  id="time"
                  service="dental"
                  date={formData.date}
                  value={formData.time}
                  onChange={(time) => setFormData((current) => ({ ...current, time }))}
                  label="Preferred time"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Dental Concerns</Label>
                <Textarea
                  id="notes"
                  placeholder="Dental concerns"
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
              </div>

              <SubmissionStatus active={isSubmitting} label="Submitting booking..." slowLabel="Still submitting booking..." />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Submitting Booking..." : "Submit Booking Request"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Service Info */}
        <aside className="min-w-0 space-y-4">
          <ServiceSummaryCard icon={Heart} title={serviceDetail?.title || "Dental Check-up"}>
              <ServiceProjectionEditor
                config={priceProjectionConfig}
                detailKey="dental"
                instructionKey="dental"
                priceFields={[
                  { key: 'dentalAssessment', label: 'Dental assessment price' },
                  { key: 'dentalCleaning', label: 'Professional cleaning price' }
                ]}
                onSave={savePriceProjectionConfig}
              />
              <ServiceProjectionDetails detail={serviceDetail}>
                <div className="space-y-1">
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">Dental Assessment:</span>{" "}
                    <span className="font-bold text-blue-700 dark:text-blue-300">{servicePrices.dentalAssessment}</span>
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    <span className="font-semibold">Professional Dental Cleaning:</span>{" "}
                    <span className="font-bold text-blue-700 dark:text-blue-300">{servicePrices.dentalCleaning}</span>
                  </p>
                  {instructions.dental && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{instructions.dental}</p>
                  )}
                </div>
              </ServiceProjectionDetails>
          </ServiceSummaryCard>

          <ServiceProjectionNote detail={serviceDetail} />
        </aside>
      </div>
    </ServicePageShell>
  );
}
