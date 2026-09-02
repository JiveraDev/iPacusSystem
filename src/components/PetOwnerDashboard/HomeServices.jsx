import { useState, useEffect } from "react";
import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { Input } from "../../ui/input";
import { Checkbox } from "../../ui/checkbox";
import { PhotoViewer } from "../../ui/photo-viewer";
import { toast } from "../../reusecomponent/toast.jsx";
import {
  Bath, Bug, Scissors, Syringe, Heart, Home, Stethoscope, Pill, Check,
  Upload, X, Image as ImageIcon, MapPin, Search, Loader2
} from "lucide-react";
import { searchAddresses } from "../../services/addressAutocomplete";
import { useCurrentAddressLookup } from "../../hooks/useCurrentAddressLookup.js";
import { DECEASED_PET_BOOKING_MESSAGE, getPetSelectLabel, getPetStatus, isPetDeceased } from "../../lib/petStatus";
import { fetchUserPets } from "../../services/petService";
import { useBookingPriceProjections } from "../../hooks/useBookingPriceProjections";
import UploadImagePreview from "../shared/UploadImagePreview.jsx";
import AddressMapPreview from "../shared/AddressMapPreview.jsx";
import BookingTimeSlotField from "../shared/BookingTimeSlotField.jsx";
import { readBookingAvailabilitySelection } from "../../lib/bookingAvailabilityNavigation.js";
import { clinicTodayDate } from "../../lib/date";
import { ServicePageHeader, ServicePageShell } from "./ServicePageLayout.jsx";
import { HomeServicesContentEditor } from './ServiceContentEditor.jsx';
import { reportBookingFormErrors, standardAppointmentBookingErrors } from '../../lib/bookingFormValidation';

const HOME_SERVICE_CARD_META = {
  "home-grooming": { selectionId: "grooming-full", icon: Scissors, includes: ["nail-trim"], order: 1 },
  "nail-trimming": { selectionId: "nail-trim", icon: Scissors, isSubService: true, order: 2 },
  "bath-blow-dry": { selectionId: "bathing", icon: Bath, order: 3 },
  "home-visit-consultation": { selectionId: "general-checkup", icon: Stethoscope, includes: ["vaccination", "medication"], order: 4 },
  vaccines: { selectionId: "vaccination", icon: Syringe, isSubService: true, order: 5 },
  deworming: { selectionId: "deworming", icon: Bug, order: 6 },
  "medication-administration": { selectionId: "medication", icon: Pill, isSubService: true, order: 7 },
  "wound-care": { selectionId: "wound-care", icon: Heart, order: 8 },
  "ear-cleaning": { selectionId: "ear-cleaning", icon: Stethoscope, order: 9 }
};

export default function HomeServices() {
  const navigate = useNavigate();
  const availabilityPrefill = readBookingAvailabilitySelection('home-service');
  const { config: priceProjectionConfig, saveConfig: savePriceProjectionConfig } = useBookingPriceProjections();
  const [pets, setPets] = useState([]);
  const [isLoadingPets, setIsLoadingPets] = useState(true);
  const [selectedPet, setSelectedPet] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);
  const [preferredDate, setPreferredDate] = useState(availabilityPrefill?.date || "");
  const [preferredTime, setPreferredTime] = useState(availabilityPrefill?.time || "");
  
  // Address State
  const [address, setAddress] = useState("");
  const [specificLocation, setSpecificLocation] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAddressLocation, setSelectedAddressLocation] = useState(null);
  const {
    clearLocationFeedback,
    isLocatingAddress,
    locationFeedback,
    useCurrentLocation,
  } = useCurrentAddressLookup((result) => {
    setAddress(result.fullAddress);
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setSelectedAddressLocation(result);
  });
  
  const [notes, setNotes] = useState("");
  const [uploadedImages, setUploadedImages] = useState([]);
  const [viewingImage, setViewingImage] = useState(null);

  // New Pet Information (for anonymous booking)
  const [isNewPet, setIsNewPet] = useState(false);
  const [newPetName, setNewPetName] = useState("");
  const [newPetSpecies, setNewPetSpecies] = useState("");
  const [newPetBreed, setNewPetBreed] = useState("");
  const [newPetAge, setNewPetAge] = useState("");
  const [newPetWeight, setNewPetWeight] = useState("");

  const homeServices = priceProjectionConfig.homeServices
    .filter((service) => service.id !== 'outside-lucena')
    .map((service) => {
      const meta = HOME_SERVICE_CARD_META[service.id] || {};
      return {
        ...service,
        id: meta.selectionId || service.id,
        icon: meta.icon || Home,
        includes: meta.includes,
        isSubService: meta.isSubService,
        order: meta.order || 1000
      };
    })
    .sort((left, right) => left.order - right.order);

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

        // Pre-fill address from user profile
        if (currentUser.personal_Address || currentUser.personal_address || currentUser.address) {
          setAddress(currentUser.personal_Address || currentUser.personal_address || currentUser.address);
        }
      } catch (error) {
        console.error("Error fetching pets:", error);
        toast.error("Failed to load your pets");
      } finally {
        setIsLoadingPets(false);
      }
    };

    fetchPets();
  }, []);

  // Address Autocomplete Logic
  useEffect(() => {
    const controller = new AbortController();
    
    const fetchSuggestions = async () => {
      if (address.length < 3 || !showSuggestions) {
        setAddressSuggestions([]);
        return;
      }

      setIsSearchingAddress(true);
      try {
        const results = await searchAddresses(address, controller.signal);
        setAddressSuggestions(results);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Address search error:", error);
        }
      } finally {
        setIsSearchingAddress(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [address, showSuggestions]);

  const handleImageUpload = (e) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    if (uploadedImages.length + fileArray.length > 5) {
      reportBookingFormErrors([{ fieldId: 'hsImageUpload', label: 'Pet photos', type: 'upload', message: 'Upload no more than 5 pet or concern photos.' }]);
      e.target.value = "";
      return;
    }
    if (fileArray.some((file) => Number(file.size || 0) > 8 * 1024 * 1024)) {
      reportBookingFormErrors([{ fieldId: 'hsImageUpload', label: 'Pet photos', type: 'upload', message: 'Each photo must be 8 MB or smaller.' }]);
      e.target.value = "";
      return;
    }
    fileArray.forEach((file) => {
      if (!file.type.startsWith("image/")) {
        reportBookingFormErrors([{ fieldId: 'hsImageUpload', label: 'Pet photos', type: 'upload', message: `${file.name} is not a supported image.` }]);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (String(event.target?.result || "").startsWith("data:image")) {
          setUploadedImages((prev) => [...prev, event.target.result]);
        } else {
          toast.error(`${file.name} could not be prepared for preview.`);
        }
      };
      reader.onerror = () => toast.error(`${file.name} could not be read. Please choose another image.`);
      reader.onabort = () => toast.error(`${file.name} preview was cancelled.`);
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const handleRemoveImage = (index) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleService = (serviceId) => {
    const service = homeServices.find(s => s.id === serviceId);
    
    setSelectedServices(prev => {
      if (prev.includes(serviceId)) {
        if (service?.includes) {
          return prev.filter(s => s !== serviceId && !service.includes.includes(s));
        }
        return prev.filter(s => s !== serviceId);
      } else {
        if (service?.includes) {
          return [...prev, serviceId, ...service.includes];
        }
        return [...prev, serviceId];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const standardErrors = standardAppointmentBookingErrors({
      formData: {
        petId: selectedPet,
        petName: newPetName,
        newPetSpecies,
        newPetBreed,
        newPetAge,
        newPetWeight,
        date: preferredDate,
        time: preferredTime,
        files: [],
      },
      isNewPet,
      today: clinicTodayDate(),
      fieldIds: {
        petName: 'home-new-pet-name',
        species: 'home-new-pet-species',
        breed: 'home-new-pet-breed',
        age: 'home-new-pet-age',
        weight: 'home-new-pet-weight',
        date: 'home-service-date',
        time: 'home-service-time',
      },
    });
    const scheduleErrors = standardErrors.filter((error) => ['home-service-date', 'home-service-time'].includes(error.fieldId));
    const validationErrors = standardErrors.filter((error) => !['home-service-date', 'home-service-time'].includes(error.fieldId));
    if (selectedServices.length === 0) {
      validationErrors.push({ fieldId: 'home-service-options', label: 'Home service', type: 'selection', message: 'Select at least one home service.' });
    }
    validationErrors.push(...scheduleErrors);
    if (!address.trim()) {
      validationErrors.push({ fieldId: 'home-service-address', label: 'Service address', type: 'missing', message: 'Enter the complete service address.' });
    }
    if (reportBookingFormErrors(validationErrors)) return;

    const selectedRegisteredPet = !isNewPet
      ? pets.find(p => p.db_id?.toString() === selectedPet)
      : null;

    if (isPetDeceased(selectedRegisteredPet)) {
      reportBookingFormErrors([{ fieldId: 'petSelect', label: 'Pet', type: 'invalid', message: DECEASED_PET_BOOKING_MESSAGE }]);
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const serviceNames = selectedServices.map(id => 
      homeServices.find(s => s.id === id)?.name || ""
    ).join(", ");

    const bookingData = {
      user_id: currentUser.id,
      pet_id: isNewPet ? null : selectedPet, // This matches db_id
      petName: isNewPet ? newPetName : selectedRegisteredPet?.name,
      petBreed: isNewPet ? newPetBreed : selectedRegisteredPet?.breed,
      petStatus: isNewPet ? "" : getPetStatus(selectedRegisteredPet),
      service_type: "home-service",
      booking_date: preferredDate,
      booking_time: preferredTime,
      notes: [
        `[Services: ${serviceNames}]`,
        notes.trim(),
      ].filter(Boolean).join("\n"),
      registered_status: isNewPet ? "Not Registered" : "Registered",
      petType: isNewPet ? newPetSpecies : selectedRegisteredPet?.species,
      new_pet_name: isNewPet ? newPetName : null,
      new_pet_breed: isNewPet ? newPetBreed : null,
      new_pet_age: isNewPet ? newPetAge : null,
      new_pet_weight: isNewPet ? newPetWeight : null,
      is_home_service: 1,
      address: address,
      specific_location: specificLocation,
      images: uploadedImages,
      transport_fee: 50
    };

    // Store in session for a final confirmation/payment screen
    sessionStorage.setItem("pendingHomeBooking", JSON.stringify(bookingData));
    
    toast.success("Details saved. Proceeding to final review...");
    navigate("/dashboard/consult/confirmation/home-service");
  };

  return (
    <ServicePageShell className="pb-10">
      <ServicePageHeader
        icon={Home}
        title="Home Service Request"
        description="Provide details for your at-home veterinary service"
        onBack={() => navigate("/dashboard/services")}
      />

      <div className="grid min-w-0 items-start gap-6">
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-blue-600" />
                Pet & Service Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Pet Selection */}
              <div className="space-y-2">
                <Label htmlFor="petSelect">Select Pet *</Label>
                <Select value={selectedPet} onValueChange={(value) => {
                  const nextPet = pets.find(p => p.db_id?.toString() === value);
                  if (value !== "new-pet" && isPetDeceased(nextPet)) {
                    toast.error(DECEASED_PET_BOOKING_MESSAGE);
                    return;
                  }

                  setSelectedPet(value);
                  setIsNewPet(value === "new-pet");
                }}>
                  <SelectTrigger id="petSelect">
                    <SelectValue 
                      placeholder={isLoadingPets ? "Loading pets..." : "Choose your pet"} 
                      displayValue={
                        selectedPet === "new-pet" 
                          ? "🐾 New Pet (Not Registered)" 
                          : pets.find(p => p.db_id?.toString() === selectedPet)?.name
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

              {/* New Pet Information */}
              {isNewPet && (
                <div className="space-y-4 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                  <h3 className="font-semibold text-blue-900 text-sm">New Pet Information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input id="home-new-pet-name" placeholder="Pet Name *" restriction="name" value={newPetName} onChange={(e) => setNewPetName(e.target.value)} />
                    <Select value={newPetSpecies} onValueChange={setNewPetSpecies}>
                      <SelectTrigger id="home-new-pet-species"><SelectValue placeholder="Species *" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Dog">Dog</SelectItem>
                        <SelectItem value="Cat">Cat</SelectItem>
                        <SelectItem value="Bird">Bird</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input id="home-new-pet-breed" placeholder="Breed *" restriction="name" value={newPetBreed} onChange={(e) => setNewPetBreed(e.target.value)} />
                    <Input id="home-new-pet-age" placeholder="Age *" restriction="integer" value={newPetAge} onChange={(e) => setNewPetAge(e.target.value)} />
                    <Input id="home-new-pet-weight" placeholder="Weight (Optional)" restriction="decimal" value={newPetWeight} onChange={(e) => setNewPetWeight(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Service Grid */}
              <div className="space-y-3">
                <Label>Select Services Needed *</Label>
                <HomeServicesContentEditor
                  config={priceProjectionConfig}
                  onSave={savePriceProjectionConfig}
                />
                <div id="home-service-options" tabIndex={-1} className="grid items-stretch gap-3 rounded-xl sm:grid-cols-2">
                  {homeServices.map((service) => {
                    const Icon = service.icon;
                    const isSelected = selectedServices.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => toggleService(service.id)}
                        className={`h-full w-full rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                          isSelected
                            ? "border-blue-600 bg-blue-50 shadow-sm dark:border-blue-500 dark:bg-blue-950/40"
                            : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${isSelected ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-slate-950 dark:text-white">{service.name}</h4>
                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{service.description}</p>
                            <p className="mt-2 text-xs font-bold text-blue-700 dark:text-blue-300">{service.price}</p>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                Service Location & Time
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Preferred Date *</Label>
                  <Input id="home-service-date" type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} min={clinicTodayDate()} />
                </div>
                <BookingTimeSlotField
                  id="home-service-time"
                  service="home-service"
                  date={preferredDate}
                  value={preferredTime}
                  onChange={setPreferredTime}
                  label="Preferred time"
                />
              </div>

              {/* Address Autocomplete */}
              <div className="space-y-2 relative">
                <Label htmlFor="home-service-address">Service Address *</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <div className="relative min-w-0 flex-1">
                    <Input
                      id="home-service-address"
                      placeholder="Search or enter your address..."
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        setShowSuggestions(true);
                        setSelectedAddressLocation(null);
                        clearLocationFeedback();
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      leftIcon={<Search className="size-4" />}
                      rightIcon={isSearchingAddress ? <Loader2 className="size-4 animate-spin text-blue-600" /> : null}
                      aria-describedby="home-service-address-feedback"
                    />

                    {showSuggestions && addressSuggestions.length > 0 && (
                      <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-white shadow-xl">
                        {addressSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            className="flex w-full items-start gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none"
                            onClick={() => {
                              setAddress(suggestion.fullAddress);
                              setShowSuggestions(false);
                              setAddressSuggestions([]);
                              setSelectedAddressLocation(suggestion);
                              clearLocationFeedback();
                            }}
                          >
                            <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{suggestion.label}</p>
                              <p className="text-xs text-gray-500">{suggestion.fullAddress}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={useCurrentLocation}
                    disabled={isLocatingAddress}
                    className="size-10 shrink-0 p-0"
                    aria-label={isLocatingAddress ? "Finding your current location" : "Use current location"}
                    title={isLocatingAddress ? "Finding your current location" : "Use current location"}
                  >
                    {isLocatingAddress ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MapPin className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div id="home-service-address-feedback" aria-live="polite">
                  {locationFeedback.message ? (
                    <p className={`text-xs ${
                      locationFeedback.type === "success" ? "text-emerald-600" : "text-amber-600"
                    }`}>
                      {locationFeedback.message}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      Choose a suggestion, use your location, or type the service address yourself.
                    </p>
                  )}
                </div>
                {selectedAddressLocation && address.trim() && (
                  <AddressMapPreview location={selectedAddressLocation} />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="home-service-location-details">Specific Location Details (Optional)</Label>
                <Input 
                  id="home-service-location-details"
                  placeholder="e.g., Unit 402"
                  value={specificLocation} 
                  onChange={(e) => setSpecificLocation(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                Photos & Additional Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Pet Photos / Concerns (Optional)</Label>
                <div className="rounded-xl border-2 border-dashed bg-gray-50/50 p-4 text-center transition-colors hover:border-blue-400 sm:p-8">
                  <input type="file" id="hsImageUpload" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                  {uploadedImages.length > 0 && (
                    <div className="mb-4 grid grid-cols-2 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-6">
                      {uploadedImages.map((img, i) => (
                        <div key={`${img}-${i}`} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <UploadImagePreview
                            src={img}
                            alt={`Uploaded concern ${i + 1}`}
                            onPreview={setViewingImage}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(i)}
                            className="absolute right-1 top-1 z-20 rounded-full bg-red-500 p-1 text-white shadow hover:bg-red-600"
                            aria-label="Remove uploaded photo"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label htmlFor="hsImageUpload" className="cursor-pointer">
                    <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium">{uploadedImages.length > 0 ? "Add more photos" : "Click to upload photos"}</p>
                    <p className="text-xs text-gray-500 mt-1">Images of your pet or specific concerns help us prepare</p>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes for the Veterinarian</Label>
                <Textarea 
                  placeholder="Care instructions"
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="min-w-0">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">Continue to Consent</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={handleSubmit} className="w-full bg-blue-600 hover:bg-blue-700 h-12" size="lg">
                Continue to Consent & Signature
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <PhotoViewer
        open={Boolean(viewingImage)}
        src={viewingImage || ""}
        alt="Home-service concern preview"
        onOpenChange={(open) => !open && setViewingImage(null)}
      />
    </ServicePageShell>
  );
}


