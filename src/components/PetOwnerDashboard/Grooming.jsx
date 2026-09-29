import { useNavigate } from "../dashboardRouter.jsx";
import { toast } from "../../reusecomponent/toast.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
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
import { readBookingAvailabilitySelection } from "../../lib/bookingAvailabilityNavigation.js";
import { clinicTodayDate } from "../../lib/date";
import { ServicePageHeader, ServicePageShell, ServiceSummaryCard } from "./ServicePageLayout.jsx";
import { reportBookingFormErrors, reportBookingSubmissionError, standardAppointmentBookingErrors } from "../../lib/bookingFormValidation";

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
  const [selectedGroomingOption, setSelectedGroomingOption] = useState(null);
  const [formData, setFormData] = useState(() => {
    const prefill = readBookingAvailabilitySelection('grooming');
    return ({
    petId: "",
    petName: "",
    newPetSpecies: "",
    newPetBreed: "",
    newPetAge: "",
    newPetWeight: "",
    branchId: prefill?.branchId ? String(prefill.branchId) : "",
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
    if (!selectedGroomingOption) {
      validationErrors.push({ fieldId: 'grooming-price-selection', label: 'Grooming service', type: 'selection', message: 'Choose a grooming service and pet size from the price table.' });
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

      // 1. Upload all files if any
      let uploadedFileUrls = [];
      if (formData.files.length > 0) {
        toast.info('Your documents are uploading. Keep this page open until they finish.');
        for (const file of formData.files) {
          try {
            const uploadedUrl = await uploadImageFile(file, 'booking_concern');
            if (uploadedUrl) {
              uploadedFileUrls.push(uploadedUrl);
            }
            } catch (uploadError) {
              throw new Error(uploadError.message || 'A grooming photo could not be uploaded. Retry or remove the file before submitting.');
          }
        }
      }

      // 2. Prepare booking data
      const selectedPreference = selectedGroomingOption
        ? `Requested grooming: ${selectedGroomingOption.service} · ${selectedGroomingOption.sizeLabel} · ${selectedGroomingOption.price}`
        : '';
      const bookingPayload = {
        user_id: userId,
        pet_id: isNewPet ? 0 : formData.petId, 
        service_type: 'grooming',
        branch_id: Number(formData.branchId),
        booking_date: formData.date,
        booking_time: formData.time,
        notes: [selectedPreference, formData.notes.trim()].filter(Boolean).join('\n'),
        Image_Booking_Concern_Path: uploadedFileUrls.join(','),
        registered_status: isNewPet ? 'Not Registered' : 'Registered',
        petType: isNewPet ? formData.newPetSpecies : (selectedRegisteredPet?.species || ''),
        new_pet_name: formData.petName,
        new_pet_breed: formData.newPetBreed,
        new_pet_age: formData.newPetAge,
        new_pet_weight: formData.newPetWeight
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

              <BranchBookingSelect
                service="grooming"
                date={formData.date}
                value={formData.branchId}
                onChange={(branchId) => setFormData((current) => ({ ...current, branchId }))}
              />

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
                  <Label htmlFor="notes">Grooming Preferences</Label>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">Grooming booking</span>
                </div>
                {selectedGroomingOption ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                    <span><strong>{selectedGroomingOption.service}</strong> · {selectedGroomingOption.sizeLabel} · {selectedGroomingOption.price}</span>
                    <button type="button" className="font-semibold underline underline-offset-2 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => setSelectedGroomingOption(null)}>Remove</button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Choose a service price from the table to add it to this booking.</p>
                )}
                <Textarea
                  id="notes"
                  placeholder="Grooming requests"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="files">Upload Photos (Optional)</Label>
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
                <div className="mt-3 overflow-x-auto rounded-lg border border-blue-100 dark:border-blue-900/60">
                  <table className="min-w-full text-xs">
                    <thead className="bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Grooming service</th>
                        <th className="px-3 py-2 text-right font-semibold">Small</th>
                        <th className="px-3 py-2 text-right font-semibold">Medium</th>
                        <th className="px-3 py-2 text-right font-semibold">Large</th>
                        <th className="px-3 py-2 text-right font-semibold">XL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-100 bg-white dark:divide-blue-900/50 dark:bg-slate-900">
                      {groomingMatrix.map((row) => (
                        <tr key={row.service}>
                          <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{row.service}</td>
                          {Object.entries(GROOMING_SIZE_LABELS).map(([size, sizeLabel]) => {
                            const selected = selectedGroomingOption?.service === row.service && selectedGroomingOption?.size === size;
                            return <td key={size} className="px-1.5 py-1.5 text-right">
                              <button
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setSelectedGroomingOption({ service: row.service, size, sizeLabel, price: row[size] })}
                                className={`min-h-8 w-full whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${selected ? 'bg-[#155dfc] text-white' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-800 dark:text-slate-300 dark:hover:bg-blue-950/40 dark:hover:text-blue-200'}`}
                              >
                                {row[size]}
                              </button>
                            </td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">Click a price to request that service and pet size. Clinic staff confirm the official Service Catalog item before grooming starts.</p>
              </ServiceProjectionDetails>
          </ServiceSummaryCard>

          <ServiceProjectionNote detail={serviceDetail} />
        </aside>
      </div>
    </ServicePageShell>
  );
}
