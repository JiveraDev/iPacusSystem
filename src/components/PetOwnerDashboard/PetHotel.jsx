import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Textarea } from "../../ui/textarea";
import { Input } from "../../ui/input";
import { toast } from "../../reusecomponent/toast.jsx";
import { Check, Home, Hotel, PawPrint } from "lucide-react";
import { differenceInDays, parseISO } from "../../lib/date";
import { resolveImageUrl } from "../../lib/image";
import { getPhilippinePhoneError, normalizePhilippinePhoneForSubmit, normalizePhilippinePhoneInput } from "../../lib/philippinePhone";
import { DECEASED_PET_BOOKING_MESSAGE, getPetStatus, isPetDeceased } from "../../lib/petStatus";
import { createBooking } from "../../services/bookingService";
import { fetchRoomAvailability } from "../../services/boardingService";
import { fetchConsentFiles } from "../../services/consentFileService";
import { fetchUserPets } from "../../services/petService";
import { createAndUploadConsentDocumentPdf } from "../../services/consentDocumentPdf";
import { normalizeConsentTemplate, pickConsentForContext } from "../../lib/consentAssignments";
import SignatureCapture from "../SignatureCapture";
import SubmissionStatus from "../shared/SubmissionStatus";
import BranchBookingSelect from "../shared/BranchBookingSelect";
import { readBookingAvailabilitySelection } from "../../lib/bookingAvailabilityNavigation.js";
import { ServicePageHeader, ServicePageShell } from "./ServicePageLayout.jsx";
import { useBookingPriceProjections } from '../../hooks/useBookingPriceProjections';
import { PetHotelContentEditor } from './ServiceContentEditor.jsx';
import { reportBookingFormErrors, reportBookingSubmissionError } from '../../lib/bookingFormValidation';
import ConsentTemplateText from '../shared/ConsentTemplateText.jsx';

const ROOM_OPTIONS = {
  hotel: [
    {
      id: "small",
      name: "Small Room",
      capacity: "1 pet",
      pricePerDay: 600,
      features: ["Climate controlled", "Comfortable bedding", "2 meals/day", "Daily cleaning"]
    },
    {
      id: "medium",
      name: "Medium Room",
      capacity: "1-2 pets",
      pricePerDay: 1200,
      features: ["Spacious area", "Comfortable bedding", "3 meals/day", "Play area access"]
    },
    {
      id: "large",
      name: "Large Room",
      capacity: "2-3 pets",
      pricePerDay: 2000,
      features: ["Extra large space", "Deluxe meals", "Private play area", "Daily grooming"]
    }
  ],
  boarding: [
    {
      id: "small",
      name: "Small Kennel",
      capacity: "1 pet",
      pricePerDay: 400,
      features: ["Secure kennel", "Basic bedding", "2 meals/day", "Outdoor time"]
    },
    {
      id: "medium",
      name: "Medium Kennel",
      capacity: "1-2 pets",
      pricePerDay: 800,
      features: ["Spacious kennel", "Comfortable bedding", "3 meals/day", "Extended outdoor time"]
    },
    {
      id: "large",
      name: "Large Kennel",
      capacity: "2-3 pets",
      pricePerDay: 1400,
      features: ["Extra large kennel", "Premium meals", "Extended play sessions", "Training activities"]
    }
  ]
};

const ADD_ON_SERVICES = [
  { id: "behavior", name: "Behavior Observation", price: 300, billing: "day" },
  { id: "playtime", name: "Extra Playtime (1hr)", price: 200, billing: "day" },
  { id: "training", name: "Basic Training Session", price: 500, billing: "stay" },
  { id: "photos", name: "Daily Photo Updates", price: 150, billing: "day" },
  { id: "medication", name: "Medication Administration", price: 200, billing: "day" },
  { id: "special-diet", name: "Special Diet Meals", price: 250, billing: "day" }
];

const ROOM_PET_LIMITS = {
  small: 1,
  medium: 2,
  large: 3
};

const SPECIES_PET_LIMITS = {
  dog: 2,
  cat: 3,
  bird: 3
};

function formatMoney(value) {
  return `PHP ${Number(value || 0).toLocaleString("en-US")}`;
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem("currentUser") || "{}");
}

function normalizeSpecies(species) {
  const value = String(species || "").trim().toLowerCase();

  if (value.includes("dog") || value.includes("canine")) return "dog";
  if (value.includes("cat") || value.includes("feline")) return "cat";
  if (value.includes("bird") || value.includes("avian")) return "bird";

  return value || "unknown";
}

function getSpeciesLabel(species) {
  const normalized = normalizeSpecies(species);
  const labels = {
    dog: "dogs",
    cat: "cats",
    bird: "birds",
    unknown: "pets"
  };

  return labels[normalized] || `${normalized}s`;
}

function getSpeciesPetLimit(species) {
  return SPECIES_PET_LIMITS[normalizeSpecies(species)] || 3;
}

function getRoomPetLimit(size) {
  return ROOM_PET_LIMITS[size] || 3;
}

export default function PetHotel() {
  const navigate = useNavigate();
  const { config: priceProjectionConfig, saveConfig: savePriceProjectionConfig } = useBookingPriceProjections();
  const roomOptions = priceProjectionConfig.boardingRooms || ROOM_OPTIONS;
  const addOnServices = priceProjectionConfig.boardingAddOns || ADD_ON_SERVICES;
  const availabilityPrefill = readBookingAvailabilitySelection('boarding');
  const prefilledRoomParts = String(availabilityPrefill?.roomType || '').split('-');
  const prefilledCheckOut = availabilityPrefill?.date
    ? new Date(`${availabilityPrefill.date}T00:00:00`)
    : null;
  if (prefilledCheckOut) prefilledCheckOut.setDate(prefilledCheckOut.getDate() + 1);
  const [today] = useState(() => new Date().toISOString().split("T")[0]);
  const [pets, setPets] = useState([]);
  const [serviceType, setServiceType] = useState(prefilledRoomParts[0] === 'boarding' ? 'boarding' : 'hotel');
  const [branchId, setBranchId] = useState(availabilityPrefill?.branchId ? String(availabilityPrefill.branchId) : "");
  const [selectedPets, setSelectedPets] = useState([]);
  const [roomSize, setRoomSize] = useState(['small', 'medium', 'large'].includes(prefilledRoomParts[1]) ? prefilledRoomParts[1] : "");
  const [checkInDate, setCheckInDate] = useState(availabilityPrefill?.date || "");
  const [checkOutDate, setCheckOutDate] = useState(prefilledCheckOut ? prefilledCheckOut.toISOString().slice(0, 10) : "");
  const [addOns, setAddOns] = useState([]);
  const [specialRequests, setSpecialRequests] = useState("");
  const [emergencyContact, setEmergencyContact] = useState(() => normalizePhilippinePhoneInput(""));
  const [roomAvailability, setRoomAvailability] = useState([]);
  const [isLoadingPets, setIsLoadingPets] = useState(true);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consentTemplates, setConsentTemplates] = useState([]);
  const [isLoadingConsent, setIsLoadingConsent] = useState(false);
  const [boardingSignature, setBoardingSignature] = useState(null);

  const stayDuration = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 0;
    const days = differenceInDays(parseISO(checkOutDate), parseISO(checkInDate));
    return days > 0 ? days : 0;
  }, [checkInDate, checkOutDate]);

  const selectedRoom = roomOptions[serviceType].find((room) => room.id === roomSize);
  const selectedPetData = useMemo(() => {
    return selectedPets
      .map((petId) => pets.find((pet) => pet.id === petId))
      .filter(Boolean);
  }, [pets, selectedPets]);
  const selectedSpecies = selectedPetData.length > 0 ? normalizeSpecies(selectedPetData[0].species) : "";
  const selectedSpeciesLimit = selectedSpecies ? getSpeciesPetLimit(selectedSpecies) : 3;
  const boardingConsentTemplate = useMemo(
    () => pickConsentForContext(consentTemplates, "boarding"),
    [consentTemplates]
  );
  const previewUser = getCurrentUser();
  const previewOwnerName = [
    previewUser.firstName || previewUser.first_Name || previewUser.first_name,
    previewUser.lastName || previewUser.last_Name || previewUser.last_name
  ].filter(Boolean).join(" ").trim() || previewUser.name || "Pet owner";
  const boardingConsentPreviewContext = {
    ownerName: previewOwnerName,
    ownerAddress: previewUser.personal_Address || previewUser.address || '',
    ownerPhone: previewUser.phoneNumber || previewUser.phone || '',
    petName: selectedPetData.map((pet) => pet.name || pet.pet_name).filter(Boolean).join(', '),
    petSpecies: selectedPetData.map((pet) => pet.species || pet.pet_species).filter(Boolean).join(', '),
    petBreed: selectedPetData.map((pet) => pet.breed || pet.pet_breed).filter(Boolean).join(', '),
    serviceName: serviceType === 'hotel' ? 'Pet Hotel Boarding' : 'Kennel Boarding'
  };

  const selectedAddOnItems = useMemo(() => {
    return addOns
      .map((addOnId) => addOnServices.find((addOn) => addOn.id === addOnId))
      .filter(Boolean);
  }, [addOns, addOnServices]);

  const estimatedTotal = useMemo(() => {
    const roomTotal = selectedRoom && stayDuration > 0 ? selectedRoom.pricePerDay * stayDuration : 0;
    const addOnTotal = selectedAddOnItems.reduce((total, addOn) => {
      const multiplier = addOn.billing === "day" ? stayDuration : 1;
      return total + addOn.price * Math.max(multiplier, 0);
    }, 0);

    return roomTotal + addOnTotal;
  }, [selectedAddOnItems, selectedRoom, stayDuration]);

  useEffect(() => {
    const loadPets = async () => {
      setIsLoadingPets(true);
      try {
        const currentUser = getCurrentUser();
        const userId = currentUser.id || currentUser.user_id || currentUser.userId;

        setEmergencyContact(normalizePhilippinePhoneInput(currentUser.phoneNumber || currentUser.phone || ""));

        if (!userId) {
          setPets([]);
          return;
        }

        const data = await fetchUserPets(userId);

        setPets(Array.isArray(data) ? data.map((pet) => ({
          id: String(pet.db_id || pet.pet_id || pet.id),
          sharableId: pet.id,
          name: pet.name || pet.petName || "Unnamed Pet",
          species: pet.species || "",
          breed: pet.breed || "",
          status: getPetStatus(pet),
          profileImage: pet.profileImage || pet.setpetImage_url || ""
        })).filter((pet) => pet.id) : []);
      } catch (error) {
        console.error("Failed to load pets for hotel booking:", error);
        toast.error("Could not load your pets.");
      } finally {
        setIsLoadingPets(false);
      }
    };

    loadPets();
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadConsentTemplates = async () => {
      setIsLoadingConsent(true);

      try {
        const data = await fetchConsentFiles();
        if (!isActive) return;

        setConsentTemplates(Array.isArray(data)
          ? data.map(normalizeConsentTemplate).filter((template) => template.id)
          : []);
      } catch (error) {
        if (isActive) {
          setConsentTemplates([]);
          toast.error(error.message || "Could not load boarding consent form.");
        }
      } finally {
        if (isActive) {
          setIsLoadingConsent(false);
        }
      }
    };

    loadConsentTemplates();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const loadAvailability = async () => {
      if (!branchId || !checkInDate || !checkOutDate || stayDuration < 1) {
        setRoomAvailability([]);
        return;
      }

      setIsLoadingAvailability(true);
      try {
        const params = new URLSearchParams({
          hotel_boarding_type: serviceType,
          check_in_date: checkInDate,
          check_out_date: checkOutDate
        });
        params.set('branch_id', branchId);
        const data = await fetchRoomAvailability(params);

        setRoomAvailability(Array.isArray(data.rooms) ? data.rooms : []);
      } catch (error) {
        console.error("Failed to load room availability:", error);
        setRoomAvailability([]);
        toast.error(error.message || "Could not load room availability.");
      } finally {
        setIsLoadingAvailability(false);
      }
    };

    loadAvailability();
  }, [branchId, checkInDate, checkOutDate, serviceType, stayDuration]);

  useEffect(() => {
    if (!roomSize || roomAvailability.length === 0) return;

    const current = roomAvailability.find((room) => room.room_size === roomSize);
    if (current && !current.available) {
      setRoomSize("");
    }
  }, [roomAvailability, roomSize]);

  const getAvailabilityForRoom = (roomId) => {
    return roomAvailability.find((room) => room.room_size === roomId);
  };

  const togglePet = (petId) => {
    setSelectedPets((current) => {
      if (current.includes(petId)) {
        return current.filter((id) => id !== petId);
      }

      const nextPet = pets.find((pet) => pet.id === petId);
      if (!nextPet) return current;

      if (isPetDeceased(nextPet)) {
        toast.error(DECEASED_PET_BOOKING_MESSAGE);
        return current;
      }

      const nextSpecies = normalizeSpecies(nextPet.species);
      const currentPetData = current
        .map((id) => pets.find((pet) => pet.id === id))
        .filter(Boolean);
      const currentSpecies = currentPetData.length > 0 ? normalizeSpecies(currentPetData[0].species) : nextSpecies;

      if (current.length > 0 && nextSpecies !== currentSpecies) {
        toast.error(`Please select pets of the same species only. Current selection is ${getSpeciesLabel(currentSpecies)}.`);
        return current;
      }

      const maxBySpecies = getSpeciesPetLimit(nextSpecies);
      const maxByRoom = getRoomPetLimit(roomSize);
      const maxAllowed = Math.min(maxBySpecies, maxByRoom);

      if (current.length >= maxAllowed) {
        toast.error(`Maximum ${maxAllowed} ${getSpeciesLabel(nextSpecies)} allowed for this room or kennel.`);
        return current;
      }

      return [...current, petId];
    });
  };

  const handleRoomSelect = (nextRoomSize) => {
    const roomLimit = getRoomPetLimit(nextRoomSize);

    if (selectedPets.length > roomLimit) {
      toast.error(`This room or kennel allows only ${roomLimit} selected pet${roomLimit === 1 ? "" : "s"}.`);
      return;
    }

    setRoomSize(nextRoomSize);
  };

  const toggleAddOn = (addOnId) => {
    setAddOns((current) =>
      current.includes(addOnId)
        ? current.filter((id) => id !== addOnId)
        : [...current, addOnId]
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const validationErrors = [];
    if (!branchId) validationErrors.push({ fieldId: 'branch-boarding', label: 'Clinic location', type: 'selection', message: 'Select a clinic location.' });
    if (!checkInDate) validationErrors.push({ fieldId: 'checkInDate', label: 'Check-in date', type: 'missing', message: 'Select a check-in date.' });
    else if (checkInDate < today) validationErrors.push({ fieldId: 'checkInDate', label: 'Check-in date', type: 'range', message: 'Check-in date cannot be in the past.' });
    if (!checkOutDate) validationErrors.push({ fieldId: 'checkOutDate', label: 'Check-out date', type: 'missing', message: 'Select a check-out date.' });
    else if (checkInDate && checkOutDate <= checkInDate) validationErrors.push({ fieldId: 'checkOutDate', label: 'Check-out date', type: 'range', message: 'Check-out date must be after check-in date.' });
    if (selectedPets.length === 0) validationErrors.push({ fieldId: 'boarding-pets', label: 'Pet', type: 'selection', message: 'Select at least one pet.' });
    if (selectedPetData.some((pet) => isPetDeceased(pet))) validationErrors.push({ fieldId: 'boarding-pets', label: 'Pet', type: 'invalid', message: DECEASED_PET_BOOKING_MESSAGE });
    const selectedSpeciesSet = new Set(selectedPetData.map((pet) => normalizeSpecies(pet.species)));
    if (selectedSpeciesSet.size > 1) {
      validationErrors.push({ fieldId: 'boarding-pets', label: 'Selected pets', type: 'invalid', message: 'Select pets of the same species only.' });
    }

    const selectedSpeciesName = selectedPetData[0] ? normalizeSpecies(selectedPetData[0].species) : "";
    const maxBySpecies = getSpeciesPetLimit(selectedSpeciesName);
    if (selectedPets.length > maxBySpecies) validationErrors.push({ fieldId: 'boarding-pets', label: 'Selected pets', type: 'range', message: `Maximum ${maxBySpecies} ${getSpeciesLabel(selectedSpeciesName)} allowed.` });
    if (!roomSize) validationErrors.push({ fieldId: 'boarding-rooms', label: 'Room or kennel', type: 'selection', message: 'Select an available room or kennel.' });

    const maxByRoom = getRoomPetLimit(roomSize);
    if (roomSize && selectedPets.length > maxByRoom) validationErrors.push({ fieldId: 'boarding-rooms', label: 'Room capacity', type: 'range', message: `The selected room or kennel allows only ${maxByRoom} pet${maxByRoom === 1 ? "" : "s"}.` });

    const emergencyContactError = getPhilippinePhoneError(emergencyContact, {
      requiredMessage: "Please provide an emergency contact number."
    });
    if (emergencyContactError) validationErrors.push({ fieldId: 'emergencyContact', label: 'Emergency contact', type: emergencyContact ? 'invalid' : 'missing', message: emergencyContactError });

    if (!boardingConsentTemplate) {
      toast.error("No boarding consent form is assigned. Please contact the clinic.");
      return;
    }

    if (!boardingSignature) validationErrors.push({ fieldId: 'boarding-signature', label: 'Owner signature', type: 'missing', message: 'Sign the boarding liability consent before submitting.' });

    const selectedAvailability = getAvailabilityForRoom(roomSize);
    if (selectedAvailability && !selectedAvailability.available) {
      validationErrors.push({ fieldId: 'boarding-rooms', label: 'Room or kennel', type: 'unavailable', message: 'The selected room or kennel is no longer available.' });
    }
    if (reportBookingFormErrors(validationErrors)) return;
    const normalizedEmergencyContact = normalizePhilippinePhoneForSubmit(emergencyContact, { optional: true });

    setIsSubmitting(true);
    try {
      const currentUser = getCurrentUser();
      const userId = currentUser.id || currentUser.user_id || currentUser.userId;
      const ownerName = [
        currentUser.firstName || currentUser.first_Name || currentUser.first_name,
        currentUser.lastName || currentUser.last_Name || currentUser.last_name
      ].filter(Boolean).join(" ").trim() || currentUser.name || "Pet owner";
      const selectedRoomLabel = selectedRoom?.name || roomSize;
      const addOnPayload = selectedAddOnItems.map((addOn) => ({
        id: addOn.id,
        name: addOn.name,
        price: addOn.price,
        billing: addOn.billing
      }));
      const notes = [
        `[Stay: ${serviceType === "hotel" ? "Pet Hotel Boarding" : "Kennel Boarding"}]`,
        `[Room: ${selectedRoomLabel}]`,
        `[Pets: ${selectedPetData.map((pet) => pet.name).join(", ")}]`,
        specialRequests.trim() ? `Special requests: ${specialRequests.trim()}` : ""
      ].filter(Boolean).join("\n");
      const signedAt = new Date().toISOString();
      const signedConsentDocumentPath = await createAndUploadConsentDocumentPdf({
        title: boardingConsentTemplate.title,
        content: boardingConsentTemplate.content,
        signatureImage: boardingSignature,
        signerName: ownerName,
        signedAt,
        templateContext: {
          ownerName,
          ownerAddress: currentUser.personal_Address || currentUser.address || '',
          ownerPhone: currentUser.phoneNumber || currentUser.phone || '',
          petName: selectedPetData.map((pet) => pet.name || pet.pet_name).filter(Boolean).join(', '),
          petSpecies: selectedPetData.map((pet) => pet.species || pet.pet_species).filter(Boolean).join(', '),
          petBreed: selectedPetData.map((pet) => pet.breed || pet.pet_breed).filter(Boolean).join(', '),
          serviceName: serviceType === 'hotel' ? 'Pet Hotel Boarding' : 'Kennel Boarding',
          branchName: selectedAvailability?.branchName || selectedAvailability?.branch_name || ''
        }
      }, "boarding_consent");
      if (!signedConsentDocumentPath) {
        throw new Error("The signed consent document could not be saved. Please try again.");
      }
      const consentForms = [{
        id: boardingConsentTemplate.id,
        title: boardingConsentTemplate.title,
        category: boardingConsentTemplate.category || "boarding",
        content: boardingConsentTemplate.content,
        signerName: ownerName,
        signedAt,
        documentPath: signedConsentDocumentPath,
        signaturePath: signedConsentDocumentPath,
        serviceType: serviceType === "hotel" ? "Pet Hotel Boarding" : "Kennel Boarding"
      }];

      await createBooking({
        user_id: Number(userId),
        pet_id: Number(selectedPets[0]),
        pet_ids: selectedPets.map((petId) => Number(petId)),
        service_type: "boarding",
        branch_id: Number(branchId),
        booking_date: checkInDate,
        booking_time: "09:00:00",
        registered_status: "Registered",
        notes,
        price: estimatedTotal,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        room_size: roomSize,
        add_ons: addOnPayload,
        emergency_contact: normalizedEmergencyContact,
        hotel_boarding_type: serviceType,
        signature: signedConsentDocumentPath,
        consent_forms: consentForms,
        consent_status: "signed"
      });

      toast.success(`${serviceType === "hotel" ? "Pet hotel boarding" : "Kennel boarding"} booking submitted for admin approval.`);
      navigate("/dashboard/services");
    } catch (error) {
      console.error("Failed to submit hotel booking:", error);
      reportBookingSubmissionError(error, {
        branch: 'branch-boarding',
        date: 'checkInDate',
        pet: 'boarding-pets',
        time: 'boarding-rooms',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ServicePageShell>
      <ServicePageHeader
        icon={Hotel}
        title="Pet Hotel & Kennel Boarding"
        description="Rooms and kennels are checked against live availability."
        onBack={() => navigate("/dashboard/services")}
      />

      <PetHotelContentEditor
        config={priceProjectionConfig}
        onSave={savePriceProjectionConfig}
      />

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Booking Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="ipawcus-dashboard-form space-y-7">
            <div className="space-y-3">
              <Label>Service Type *</Label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  { id: "hotel", title: "Pet Hotel Boarding", description: "Premium rooms with comfort amenities", icon: Hotel },
                  { id: "boarding", title: "Kennel Boarding", description: "Secure kennels with daily care", icon: Home }
                ].map((option) => {
                  const Icon = option.icon;
                  const isSelected = serviceType === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setServiceType(option.id);
                        setRoomSize("");
                      }}
                      className={`rounded-lg border-2 p-4 text-left transition-all ${
                        isSelected ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <Icon className={`mb-2 h-8 w-8 ${isSelected ? "text-blue-600" : "text-gray-600"}`} />
                      <h4 className="font-bold text-gray-900">{option.title}</h4>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <BranchBookingSelect
              service="boarding"
              date={checkInDate}
              value={branchId}
              onChange={setBranchId}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="checkInDate">Check-in Date *</Label>
                <Input
                  id="checkInDate"
                  type="date"
                  value={checkInDate}
                  onChange={(event) => {
                    setCheckInDate(event.target.value);
                    if (checkOutDate && event.target.value && checkOutDate <= event.target.value) {
                      setCheckOutDate("");
                    }
                  }}
                  required
                  min={today}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkOutDate">Check-out Date *</Label>
                <Input
                  id="checkOutDate"
                  type="date"
                  value={checkOutDate}
                  onChange={(event) => setCheckOutDate(event.target.value)}
                  required
                  min={checkInDate || today}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Select Pet(s) * (same species only)</Label>
              <p className="text-xs text-gray-500">
                Dogs are limited to 2. Cats and birds are limited to 3. Selected pets cannot be mixed species.
                {selectedSpecies && ` Current selection: ${selectedPets.length}/${selectedSpeciesLimit} ${getSpeciesLabel(selectedSpecies)}.`}
              </p>
              {isLoadingPets ? (
                <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-600">Loading pets...</div>
              ) : pets.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  No registered pets found for this account.
                </div>
              ) : (
                <div id="boarding-pets" tabIndex={-1} className="grid grid-cols-1 gap-3 rounded-xl sm:grid-cols-2 lg:grid-cols-3">
                  {pets.map((pet) => {
                    const isSelected = selectedPets.includes(pet.id);
                    const petSpecies = normalizeSpecies(pet.species);
                    const isBlockedBySpecies = Boolean(selectedSpecies) && !isSelected && petSpecies !== selectedSpecies;
                    const isDeceased = isPetDeceased(pet);
                    const petImage = resolveImageUrl(pet.profileImage);

                    return (
                      <button
                        key={pet.id}
                        type="button"
                        disabled={isBlockedBySpecies || isDeceased}
                        onClick={() => togglePet(pet.id)}
                        className={`rounded-lg border-2 p-4 text-center transition-all ${
                          isSelected
                            ? "border-blue-600 bg-blue-50"
                            : isBlockedBySpecies || isDeceased
                              ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
                              : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 ${
                          isSelected ? "border-blue-600 bg-blue-100" : "border-gray-200 bg-gray-100"
                        }`}>
                          {petImage ? (
                            <img
                              src={petImage}
                              alt={`${pet.name} profile`}
                              className="h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <PawPrint className={`h-7 w-7 ${isSelected ? "text-blue-600" : "text-gray-500"}`} />
                          )}
                        </div>
                        <h3 className="font-bold text-gray-900">{pet.name}</h3>
                        <p className="mt-1 text-xs text-gray-500">{[pet.species, pet.breed].filter(Boolean).join(" - ")}</p>
                        {isDeceased && (
                          <p className="mt-2 text-xs font-semibold text-slate-500">Deceased - cannot book</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>Select Room/Kennel Size *</Label>
                {isLoadingAvailability && <span className="text-xs text-gray-500">Checking availability...</span>}
              </div>
              <div id="boarding-rooms" tabIndex={-1} className="grid gap-4 rounded-xl md:grid-cols-3">
                {roomOptions[serviceType].map((room) => {
                  const availability = getAvailabilityForRoom(room.id);
                  const availableCount = availability?.available_count;
                  const isUnavailable = availability && !availability.available;
                  const canSelect = !isUnavailable && stayDuration > 0;

                  return (
                    <button
                      key={room.id}
                      type="button"
                      disabled={isUnavailable}
                      onClick={() => canSelect && handleRoomSelect(room.id)}
                      className={`rounded-lg border-2 p-4 text-left transition-all ${
                        roomSize === room.id
                          ? "border-blue-600 bg-blue-50"
                          : isUnavailable
                            ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-70"
                            : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-bold text-gray-900">{room.name}</h4>
                          <p className="text-sm text-gray-600">{formatMoney(room.pricePerDay)}/day</p>
                          <p className="text-xs text-gray-500">{room.capacity}</p>
                        </div>
                        {availability && (
                          <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                            isUnavailable ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                          }`}>
                            {availableCount} left
                          </span>
                        )}
                      </div>
                      <div className="mt-3 space-y-1">
                        {room.features.map((feature) => (
                          <p key={feature} className="flex items-center gap-2 text-xs text-gray-600">
                            <Check className="h-3 w-3 text-green-600" />
                            {feature}
                          </p>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
              {stayDuration < 1 && (
                <p className="text-xs text-gray-500">Select valid check-in and check-out dates to check room availability.</p>
              )}
            </div>

            <div className="space-y-3">
              <Label>Add-ons</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {addOnServices.map((addOn) => {
                  const isSelected = addOns.includes(addOn.id);

                  return (
                    <button
                      key={addOn.id}
                      type="button"
                      onClick={() => toggleAddOn(addOn.id)}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        isSelected ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-900">{addOn.name}</span>
                        <span className="text-sm text-gray-600">{formatMoney(addOn.price)}/{addOn.billing}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emergencyContact">Emergency Contact *</Label>
                <Input
                  id="emergencyContact"
                  value={emergencyContact}
                  onChange={(event) => setEmergencyContact(normalizePhilippinePhoneInput(event.target.value))}
                  inputMode="tel"
                  restriction="phone"
                  maxLength={13}
                  placeholder="+639"
                  required
                />
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-bold text-gray-900">Estimated Total</p>
                <p className="mt-1 text-2xl font-bold text-blue-700">{formatMoney(estimatedTotal)}</p>
                <p className="mt-1 text-xs text-gray-600">{stayDuration || 0} night(s)</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialRequests">Special Requests</Label>
              <Textarea
                id="specialRequests"
                value={specialRequests}
                onChange={(event) => setSpecialRequests(event.target.value)}
                  placeholder="Care instructions"
              />
            </div>

            <section className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Boarding Liability Consent</h3>
                  <p className="mt-1 text-sm font-medium text-gray-600">
                    Required before the booking can be submitted for payment or activation.
                  </p>
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                  boardingSignature ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {boardingSignature ? "Signed" : "Signature required"}
                </span>
              </div>

              <div className="rounded-lg border border-blue-100 bg-white p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <p className="font-bold text-gray-900">
                    {isLoadingConsent
                      ? "Loading consent form..."
                      : boardingConsentTemplate?.title || "No boarding consent assigned"}
                  </p>
                  {boardingConsentTemplate && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                      {boardingConsentTemplate.category || "boarding"}
                    </span>
                  )}
                </div>
                <ConsentTemplateText
                  content={boardingConsentTemplate?.content}
                  context={boardingConsentPreviewContext}
                  fallback="An admin must assign a boarding consent form in Consent Management before this booking can be submitted."
                  className="max-h-56 overflow-y-auto text-sm font-medium leading-6 text-gray-700"
                />
              </div>

              <div id="boarding-signature" tabIndex={-1} className="space-y-2 rounded-xl">
                <Label>Owner Signature *</Label>
                <SignatureCapture
                  signature={boardingSignature}
                  onSignatureChange={setBoardingSignature}
                  disabled={isSubmitting || isLoadingConsent || !boardingConsentTemplate}
                />
              </div>
            </section>

            <SubmissionStatus active={isSubmitting} label="Submitting booking..." slowLabel="Still submitting booking..." />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting || isLoadingPets || pets.length === 0 || !boardingConsentTemplate}
            >
              {isSubmitting
                ? "Submitting Booking..."
                : !boardingConsentTemplate
                  ? "Assign Consent Before Signing"
                  : boardingSignature ? "Submit Booking" : "Sign Consent to Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </ServicePageShell>
  );
}
