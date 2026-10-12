import { useNavigate } from "../dashboardRouter.jsx";
import { toast } from "../../reusecomponent/toast.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import Label from "../shared/BookingFieldLabel.jsx";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Scissors } from "lucide-react";
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
import BranchBookingSelect from "../shared/BranchBookingSelect";
import BookingTimeSlotField from "../shared/BookingTimeSlotField";
import { preferredVeterinarianNote, readBookingAvailabilitySelection } from "../../lib/bookingAvailabilityNavigation.js";
import { clinicTodayDate } from "../../lib/date";
import { ServicePageHeader, ServicePageShell, ServiceSummaryCard } from "./ServicePageLayout.jsx";
import { reportBookingFormErrors, reportBookingSubmissionError, standardAppointmentBookingErrors } from "../../lib/bookingFormValidation";
import { PetBreedAutocomplete, PetSpeciesAutocomplete } from "../shared/PetCatalogAutocomplete.jsx";

const GROOMING_SIZE_LABELS = { small: 'Small', medium: 'Medium', large: 'Large', xl: 'XL' };

export default function Grooming() {
  const navigate = useNavigate();
  const { config: priceProjectionConfig, saveConfig: savePriceProjectionConfig } = useBookingPriceProjections();
  const { groomingMatrix, instructions, serviceDetails, servicePrices } = priceProjectionConfig;
  const serviceDetail = serviceDetails.grooming;
  const [pets, setPets] = useState([]);
  const [isLoadingPets, setIsLoadingPets] = useState(true);
  const [isNewPet, setIsNewPet] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedGroomingOptions, setSelectedGroomingOptions] = useState([]);
  const [formData, setFormData] = useState(() => {
    const prefill = readBookingAvailabilitySelection('grooming');
    return ({
    petId: "",
    petName: "",
    newPetSpecies: "",
    newPetBreed: "",
    newPetAge: "",
    newPetWeight: "",
    newPetColorMarkings: "",
    branchId: prefill?.branchId ? String(prefill.branchId) : "",
    date: prefill?.date || "",
    time: prefill?.time || "",
    notes: preferredVeterinarianNote(prefill),
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
        toast.error('We could not load your pets. Refresh the page or try again.');
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
      branchRequired: true,
      branchFieldId: 'branch-grooming',
      today: clinicTodayDate(),
    });
    if (selectedGroomingOptions.length === 0) {
      validationErrors.push({ fieldId: 'grooming-price-selection', label: 'Grooming services', type: 'selection', message: 'Choose at least one grooming service and pet size from the price list.' });
    }
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

      // 1. Upload the single owner concern photo, if provided.
      let uploadedFileUrls = [];
      if (formData.files.length > 0) {
        toast.info('Your concern photo is uploading. Keep this page open until it finishes.');
        try {
          const uploadedUrl = await uploadImageFile(formData.files[0], 'booking_concern');
          if (uploadedUrl) {
            uploadedFileUrls = [uploadedUrl];
          }
        } catch (uploadError) {
          throw new Error(uploadError.message || 'The grooming concern photo could not be uploaded. Retry or remove it before submitting.');
        }
      }

      // 2. Prepare booking data
      const selectedPreferences = selectedGroomingOptions.map(option => (
        `Requested grooming: ${option.service} · ${option.sizeLabel} · ${option.price}`
      ));
      const bookingPayload = {
        user_id: userId,
        pet_id: isNewPet ? 0 : formData.petId, 
        service_type: 'grooming',
        branch_id: Number(formData.branchId),
        booking_date: formData.date,
        booking_time: formData.time,
        notes: [...selectedPreferences, formData.notes.trim()].filter(Boolean).join('\n'),
        Image_Booking_Concern_Path: uploadedFileUrls.join(','),
        registered_status: isNewPet ? 'Not Registered' : 'Registered',
        petType: isNewPet ? formData.newPetSpecies : (selectedRegisteredPet?.species || ''),
        new_pet_name: isNewPet ? formData.petName : null,
        new_pet_breed: isNewPet ? formData.newPetBreed : null,
        new_pet_age: isNewPet ? formData.newPetAge : null,
        new_pet_weight: isNewPet ? formData.newPetWeight : null,
        new_pet_color_markings: isNewPet ? formData.newPetColorMarkings : null
      };

      await createBooking(bookingPayload);

      toast.success('Booking submitted for admin approval.');
      navigate("/dashboard/services");
    } catch (error) {
      console.error("Booking error:", error);
      reportBookingSubmissionError(error, { branch: 'branch-grooming' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (files) => {
    const newFiles = Array.from(files || []);
    if (newFiles.length === 0) return;

    setFormData(prev => ({
      ...prev,
      files: [newFiles[0]]
    }));
  };

  const toggleGroomingOption = (option) => {
    const optionKey = `${option.service}::${option.size}`;
    setSelectedGroomingOptions(current => current.some(item => `${item.service}::${item.size}` === optionKey)
      ? current.filter(item => `${item.service}::${item.size}` !== optionKey)
      : [...current, option]);
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
        icon={Scissors}
        title="Grooming"
        description="Professional grooming services for your pet"
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
                        restriction="pet-name"
                        required={isNewPet}
                        value={formData.petName}
                        onChange={(e) => setFormData({ ...formData, petName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPetSpecies">Species *</Label>
                      <PetSpeciesAutocomplete id="newPetSpecies" placeholder="Type or choose a species" required={isNewPet} value={formData.newPetSpecies} onChange={(event) => setFormData({ ...formData, newPetSpecies: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPetBreed">Breed *</Label>
                      <PetBreedAutocomplete
                        id="newPetBreed"
                        species={formData.newPetSpecies}
                        placeholder="Type or choose a breed"
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
                        restriction="pet-age"
                        required={isNewPet}
                        value={formData.newPetAge}
                        onChange={(e) => setFormData({ ...formData, newPetAge: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPetWeight">Weight (Optional)</Label>
                      <Input
                        id="newPetWeight"
                        placeholder="e.g., 25.5"
                        restriction="pet-weight"
                        value={formData.newPetWeight}
                        onChange={(e) => setFormData({ ...formData, newPetWeight: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPetColorMarkings">Color / Markings (Optional)</Label>
                      <Input id="newPetColorMarkings" placeholder="e.g., Black and white" restriction="pet-markings" value={formData.newPetColorMarkings} onChange={(event) => setFormData({ ...formData, newPetColorMarkings: event.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              <BranchBookingSelect
                service="grooming"
                date={formData.date}
                value={formData.branchId}
                onChange={(branchId) => setFormData((current) => ({ ...current, branchId }))}
                persistSelection
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date">Preferred date *</Label>
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
                  service="grooming"
                  date={formData.date}
                  branchId={formData.branchId}
                  value={formData.time}
                  onChange={(time) => setFormData((current) => ({ ...current, time }))}
                  label="Preferred time"
                />
              </div>

              <div id="grooming-price-selection" className="space-y-2" tabIndex={-1}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Grooming services *</Label>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">Grooming booking</span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Service</th>
                        {Object.values(GROOMING_SIZE_LABELS).map(sizeLabel => <th key={sizeLabel} className="px-3 py-2 text-center font-semibold">{sizeLabel}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                      {groomingMatrix.map(row => (
                        <tr key={row.service}>
                          <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{row.service}</td>
                          {Object.entries(GROOMING_SIZE_LABELS).map(([size, sizeLabel]) => {
                            const selected = selectedGroomingOptions.some(option => option.service === row.service && option.size === size);
                            return <td key={size} className="px-1.5 py-1.5 text-center">
                              <button
                                type="button"
                                aria-pressed={selected}
                                aria-label={`${selected ? 'Remove' : 'Add'} ${row.service}, ${sizeLabel}, ${row[size]}`}
                                onClick={() => toggleGroomingOption({ service: row.service, size, sizeLabel, price: row[size] })}
                                className={`min-h-9 w-full whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${selected ? 'bg-[#155dfc] text-white' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-800 dark:text-slate-300 dark:hover:bg-blue-950/40 dark:hover:text-blue-200'}`}
                              >
                                {selected ? '✓ ' : ''}{row[size]}
                              </button>
                            </td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {selectedGroomingOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/60 dark:bg-blue-950/20">
                    {selectedGroomingOptions.map(option => (
                      <button
                        key={`${option.service}-${option.size}`}
                        type="button"
                        onClick={() => toggleGroomingOption(option)}
                        className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-800 hover:border-blue-400 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200"
                        aria-label={`Remove ${option.service}, ${option.sizeLabel}`}
                      >
                        {option.service} · {option.sizeLabel} · {option.price} ×
                      </button>
                    ))}
                  </div>
                )}
                <Label htmlFor="notes" help="Describe any grooming concerns or care instructions for the team.">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Describe the concern, preferred style, sensitivities, or special instructions"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="files" help="Upload one JPG, PNG, or WebP image up to 8 MB. It will be shown to the grooming team and assigned veterinarian.">Concern photo (optional)</Label>
                <FileUploadDropzone
                  id="files"
                  accept="image/jpeg,image/png,image/webp"
                  files={formData.files}
                  onFilesSelected={handleFileChange}
                  onRemove={removeFile}
                  label="Upload one concern photo"
                  helper=""
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
          <ServiceSummaryCard icon={Scissors} title={serviceDetail?.title || "Grooming"}>
              <ServiceProjectionEditor
                config={priceProjectionConfig}
                detailKey="grooming"
                instructionKey="grooming"
                priceFields={[{ key: 'grooming', label: 'Displayed price range' }]}
                matrixConfig={{
                  key: 'groomingMatrix',
                  label: 'Grooming price table',
                  identityField: 'service',
                  columns: [
                    { key: 'service', label: 'Service', wide: true },
                    { key: 'small', label: 'Small' },
                    { key: 'medium', label: 'Medium' },
                    { key: 'large', label: 'Large' },
                    { key: 'xl', label: 'XL' }
                  ]
                }}
                onSave={savePriceProjectionConfig}
              />
              <ServiceProjectionDetails detail={serviceDetail}>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{servicePrices.grooming}</p>
                {instructions.grooming && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{instructions.grooming}</p>
                )}
                <p className="mt-3 text-[11px] leading-4 text-slate-500 dark:text-slate-400">The editable price list is shown inside the booking form. Clinic staff still confirm the official Service Catalog charge before grooming starts.</p>
              </ServiceProjectionDetails>
          </ServiceSummaryCard>

          <ServiceProjectionNote detail={serviceDetail} />
        </aside>
      </div>
    </ServicePageShell>
  );
}
