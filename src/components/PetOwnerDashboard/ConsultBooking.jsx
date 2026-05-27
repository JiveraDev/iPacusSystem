import { useState, useEffect } from "react";
import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { Input } from "../../ui/input";
import { toast } from "../../reusecomponent/toast.jsx";
import { ArrowLeft, Image as ImageIcon, Upload, X } from "lucide-react";
import { addDays, format } from "../../lib/date";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const TIME_SLOT_ORDER = [
  "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM",
  "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM"
];
const DEFAULT_AVAILABILITY = {
  monday: ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"],
  tuesday: ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"],
  wednesday: ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"],
  thursday: ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"],
  friday: ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"],
  saturday: ["09:00 AM", "10:00 AM", "11:00 AM"],
  sunday: []
};

function toId(value) {
  return value === null || value === undefined ? "" : String(value);
}

function getPetId(pet) {
  return toId(pet?.db_id ?? pet?.pet_id ?? pet?.id);
}

function getPetName(pet) {
  return pet?.name || pet?.pet_name || pet?.petName || "";
}

function getPetSpecies(pet) {
  return pet?.species || pet?.pet_species || "";
}

function getPetBreed(pet) {
  return pet?.breed || pet?.pet_breed || "";
}

function getPetAge(pet) {
  return pet?.age || pet?.pet_age || "";
}

function getPetWeight(pet) {
  return pet?.weight || pet?.pet_weight || "";
}

function sortTimeSlots(slots) {
  return [...new Set(slots)].sort((first, second) => {
    const firstIndex = TIME_SLOT_ORDER.indexOf(first);
    const secondIndex = TIME_SLOT_ORDER.indexOf(second);

    if (firstIndex === -1 && secondIndex === -1) return first.localeCompare(second);
    if (firstIndex === -1) return 1;
    if (secondIndex === -1) return -1;
    return firstIndex - secondIndex;
  });
}

function formatBookingTimeSlot(timeValue) {
  const value = String(timeValue || "").trim();
  if (!value) return "";

  const [hourValue, minuteValue = "0"] = value.split(":");
  const hours = Number(hourValue);
  const minutes = Number(minuteValue);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return "";

  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function isAvailableSchedule(schedule) {
  return Number(schedule?.is_available) === 1 || schedule?.is_available === true;
}

function buildAvailabilityFromSchedules(schedules) {
  return schedules.reduce((availability, schedule) => {
    if (!isAvailableSchedule(schedule) || !schedule.time_slot) {
      return availability;
    }

    const day = String(schedule.day_of_week || "").trim().toLowerCase();
    if (!day) {
      return availability;
    }

    return {
      ...availability,
      [day]: sortTimeSlots([...(availability[day] || []), schedule.time_slot])
    };
  }, {});
}

function getVetLabel(vet) {
  return vet ? `${vet.name} - ${vet.specialization}` : "";
}

function parseDateInput(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export default function ConsultBooking() {
  const navigate = useNavigate();
  const [pets, setPets] = useState([]);
  const [veterinarians, setVeterinarians] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPet, setSelectedPet] = useState("");
  const [discussionTopic, setDiscussionTopic] = useState([]);
  const [notes, setNotes] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedVet, setSelectedVet] = useState("");
  const [concernImages, setConcernImages] = useState([]);
  const [existingConsultBookings, setExistingConsultBookings] = useState([]);

  // New Pet Information (for anonymous booking)
  const [isNewPet, setIsNewPet] = useState(false);
  const [newPetName, setNewPetName] = useState("");
  const [newPetSpecies, setNewPetSpecies] = useState("");
  const [newPetBreed, setNewPetBreed] = useState("");
  const [newPetAge, setNewPetAge] = useState("");
  const [newPetWeight, setNewPetWeight] = useState("");
  const [newPetMedicalConditions, setNewPetMedicalConditions] = useState("");

  const discussionTopics = ["Weight Issues", "Symptoms/Illness", "Behavior", "Nutrition", "Other"];
  const selectedPetData = pets.find((pet) => getPetId(pet) === selectedPet);
  const selectedVetData = veterinarians.find((vet) => vet.id === selectedVet);

  // Get available time slots for selected vet and date
  const getAvailableTimeSlots = () => {
    if (!selectedVet || !selectedDate) return [];
    
    const vet = veterinarians.find(v => v.id === selectedVet);
    if (!vet) return [];

    const date = parseDateInput(selectedDate);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const baseSlots = (vet.availability && vet.availability[dayName]) || [];
    const occupiedSlots = existingConsultBookings
      .filter((booking) => (
        booking &&
        booking.isOnlineConsultation &&
        String(booking.veterinarianId) === String(selectedVet) &&
        String(booking.date) === String(selectedDate) &&
        ["pending", "confirmed"].includes(String(booking.status || "").toLowerCase())
      ))
      .map((booking) => formatBookingTimeSlot(booking.time))
      .filter(Boolean);

    return baseSlots.filter((slot) => !occupiedSlots.includes(slot));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const userId = currentUser.id || currentUser.user_id;

        if (!userId) {
          toast.error("Session error. Please log in again.");
          return;
        }

        // Fetch Pets
        const petsResponse = await fetch(`${API_BASE}/api/users/${userId}/pets`);
        if (!petsResponse.ok) {
          throw new Error("Failed to load pets");
        }
        const petsData = await petsResponse.json();
        setPets(Array.isArray(petsData) ? petsData : []);

        // Fetch Veterinarians
        const vetsResponse = await fetch(`${API_BASE}/api/accounts`);
        if (!vetsResponse.ok) {
          throw new Error("Failed to load veterinarians");
        }
        const vetsData = await vetsResponse.json();
        const vetAccounts = Array.isArray(vetsData?.veterinarians) ? vetsData.veterinarians : [];
        const scheduleResults = await Promise.all(vetAccounts.map(async (vet) => {
          const vetId = toId(vet.user_id);

          try {
            const scheduleResponse = await fetch(`${API_BASE}/api/vet_schedules?userId=${encodeURIComponent(vetId)}`);
            if (!scheduleResponse.ok) {
              throw new Error("Schedule request failed");
            }

            const schedules = await scheduleResponse.json();
            return {
              vetId,
              hasScheduleRows: Array.isArray(schedules) && schedules.length > 0,
              availability: Array.isArray(schedules) ? buildAvailabilityFromSchedules(schedules) : {}
            };
          } catch (error) {
            console.error(`Failed to load schedule for veterinarian ${vetId}:`, error);
            return {
              vetId,
              hasScheduleRows: false,
              availability: {}
            };
          }
        }));
        const schedulesByVet = new Map(scheduleResults.map((result) => [result.vetId, result]));
        
        if (vetAccounts.length > 0) {
          const formattedVets = vetAccounts.map(v => {
            const vetId = toId(v.user_id);
            const schedule = schedulesByVet.get(vetId);

            return {
              id: vetId,
              userId: v.user_id,
              name: `Dr. ${v.first_Name} ${v.last_Name}`,
              specialization: v.specialization || "General Practice",
              availability: schedule?.hasScheduleRows ? schedule.availability : DEFAULT_AVAILABILITY
            };
          });
          setVeterinarians(formattedVets);
        }

        const bookingsResponse = await fetch(`${API_BASE}/api/bookings`);
        if (bookingsResponse.ok) {
          const bookingsData = await bookingsResponse.json();
          setExistingConsultBookings(Array.isArray(bookingsData) ? bookingsData : []);
        } else {
          setExistingConsultBookings([]);
        }
      } catch (error) {
        console.error("Error fetching booking data:", error);
        toast.error("Failed to load necessary information. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleDiscussionTopic = (topic) => {
    setDiscussionTopic(prev => 
      prev.includes(topic) 
        ? prev.filter(t => t !== topic)
        : [...prev, topic]
    );
  };

  // Reset date and time when veterinarian changes
  const handleVetChange = (vetId) => {
    setSelectedVet(vetId);
    setSelectedDate("");
    setSelectedTime("");
  };

  // Reset time when date changes
  const handleDateChange = (date) => {
    setSelectedDate(date);
    setSelectedTime("");
  };

  useEffect(() => {
    if (!selectedTime || !selectedVet || !selectedDate) return;

    const vet = veterinarians.find(v => v.id === selectedVet);
    if (!vet) return;

    const date = parseDateInput(selectedDate);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const baseSlots = (vet.availability && vet.availability[dayName]) || [];
    const occupiedSlots = existingConsultBookings
      .filter((booking) => (
        booking &&
        booking.isOnlineConsultation &&
        String(booking.veterinarianId) === String(selectedVet) &&
        String(booking.date) === String(selectedDate) &&
        ["pending", "confirmed"].includes(String(booking.status || "").toLowerCase())
      ))
      .map((booking) => formatBookingTimeSlot(booking.time))
      .filter(Boolean);
    const currentAvailableSlots = baseSlots.filter((slot) => !occupiedSlots.includes(slot));

    if (!currentAvailableSlots.includes(selectedTime)) {
      setSelectedTime("");
    }
  }, [existingConsultBookings, selectedVet, selectedDate, selectedTime, veterinarians]);

  const handleConcernImageUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        if (loadEvent.target?.result) {
          setConcernImages((prev) => [...prev, loadEvent.target.result]);
        }
      };
      reader.readAsDataURL(file);
    });

    event.target.value = "";
  };

  const handleRemoveConcernImage = (index) => {
    setConcernImages((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!selectedPet) {
      toast.error("Please select a pet");
      return;
    }
    
    // Validate new pet information if "New Pet" is selected
    if (isNewPet) {
      if (!newPetName) {
        toast.error("Please enter the pet's name");
        return;
      }
      if (!newPetSpecies) {
        toast.error("Please select the pet's species");
        return;
      }
      if (!newPetBreed) {
        toast.error("Please enter the pet's breed");
        return;
      }
      if (!newPetAge) {
        toast.error("Please enter the pet's age");
        return;
      }
    }
    
    if (discussionTopic.length === 0) {
      toast.error("Please select at least one discussion topic");
      return;
    }
    if (!selectedVet) {
      toast.error("Please select a veterinarian");
      return;
    }
    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }
    if (!selectedTime) {
      toast.error("Please select a time");
      return;
    }
    if (!getAvailableTimeSlots().includes(selectedTime)) {
      toast.error("Please select an available time slot");
      return;
    }

    // Store booking data in session storage
    const bookingData = {
      petId: isNewPet ? "new-pet" : selectedPet,
      petDbId: isNewPet ? null : getPetId(selectedPetData),
      petShareableId: isNewPet ? null : selectedPetData?.id || selectedPetData?.pet_sharable_ID || "",
      petName: isNewPet ? newPetName : getPetName(selectedPetData),
      petSpecies: isNewPet ? newPetSpecies : getPetSpecies(selectedPetData),
      petBreed: isNewPet ? newPetBreed : getPetBreed(selectedPetData),
      petAge: isNewPet ? newPetAge : getPetAge(selectedPetData),
      petWeight: isNewPet ? newPetWeight : getPetWeight(selectedPetData),
      petMedicalConditions: isNewPet ? newPetMedicalConditions : "",
      discussionTopic: discussionTopic.join(", "),
      notes,
      date: format(selectedDate, "yyyy-MM-dd"),
      time: selectedTime,
      veterinarianId: selectedVet,
      veterinarian: selectedVetData?.name,
      dateTime: `${format(selectedDate, "yyyy-MM-dd")} ${selectedTime}`,
      concernImages,
    };

    sessionStorage.setItem("pendingBooking", JSON.stringify(bookingData));
    navigate("/dashboard/consult/payment");
  };

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#155dfc] border-t-transparent"></div>
          <p className="text-sm font-medium text-slate-500">Loading booking form...</p>
        </div>
      </div>
    );
  }

  if (pets.length === 0 && !isNewPet) {
    return (
      <div className="space-y-8 max-w-3xl">
        <Button variant="ghost" onClick={() => navigate("/dashboard/consult")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Consultations
        </Button>
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <h3 className="font-semibold text-lg mb-2">No Pets Registered</h3>
            <p className="text-gray-600 mb-4">
              You can add your first pet or book a consultation for a new unregistered pet.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate("/dashboard/my-pets/add")}>
                Add Your First Pet
              </Button>
              <Button variant="outline" onClick={() => {
                setSelectedPet("new-pet");
                setIsNewPet(true);
              }}>
                🐾 Book for New Pet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8 max-w-3xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/dashboard/consult")} className="self-start">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Book Online Consultation</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consultation Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Select Pet */}
            <div className="space-y-2">
              <Label>Select Pet</Label>
              <Select value={selectedPet} onValueChange={(value) => {
                setSelectedPet(value);
                if (value === "new-pet") {
                  setIsNewPet(true);
                } else {
                  setIsNewPet(false);
                }
              }}>
                <SelectTrigger>
                  <SelectValue
                    placeholder="Choose your pet"
                    displayValue={isNewPet ? "New Pet (Not Registered)" : getPetName(selectedPetData)}
                  />
                </SelectTrigger>
                <SelectContent>
                  {pets.map((pet) => (
                    <SelectItem key={getPetId(pet)} value={getPetId(pet)}>
                      {getPetName(pet)} ({getPetSpecies(pet)} - {getPetBreed(pet)})
                    </SelectItem>
                  ))}
                  <SelectItem value="new-pet">
                    🐾 New Pet (Not Registered)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* New Pet Information Form */}
            {isNewPet && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <h3 className="font-semibold text-blue-900">New Pet Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPetName">Pet Name *</Label>
                    <Input
                      id="newPetName"
                      type="text"
                      placeholder="e.g., Buddy"
                      value={newPetName}
                      onChange={(e) => setNewPetName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPetSpecies">Species *</Label>
                    <Select value={newPetSpecies} onValueChange={setNewPetSpecies}>
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
                      type="text"
                      placeholder="e.g., Golden Retriever"
                      value={newPetBreed}
                      onChange={(e) => setNewPetBreed(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPetAge">Age *</Label>
                    <Input
                      id="newPetAge"
                      type="text"
                      placeholder="e.g., 2 years"
                      value={newPetAge}
                      onChange={(e) => setNewPetAge(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPetWeight">Weight (Optional)</Label>
                    <Input
                      id="newPetWeight"
                      type="text"
                      placeholder="e.g., 25 kg"
                      value={newPetWeight}
                      onChange={(e) => setNewPetWeight(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="newPetMedicalConditions">Medical Conditions (Optional)</Label>
                    <Textarea
                      id="newPetMedicalConditions"
                      placeholder="Any known allergies, conditions, or medications..."
                      value={newPetMedicalConditions}
                      onChange={(e) => setNewPetMedicalConditions(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Discussion Topics */}
            <div className="space-y-2">
              <Label>Discussion Topics</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {discussionTopics.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleDiscussionTopic(topic)}
                    className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                      discussionTopic.includes(topic)
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>

            {/* Select Veterinarian */}
            <div className="space-y-2">
              <Label>Select Veterinarian</Label>
              <Select value={selectedVet} onValueChange={handleVetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a veterinarian" displayValue={getVetLabel(selectedVetData)} />
                </SelectTrigger>
                <SelectContent>
                  {veterinarians.map((vet) => (
                    <SelectItem key={vet.id} value={vet.id}>
                      {vet.name} - {vet.specialization}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedVet && (
                <p className="text-sm text-gray-600">
                  View {selectedVetData?.name}'s available time slots below
                </p>
              )}
            </div>

            {/* Select Date */}
            <div className="space-y-2">
              <Label htmlFor="selectedDate">Select Date</Label>
              <Input
                id="selectedDate"
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                min={format(addDays(new Date(), 1), "yyyy-MM-dd")}
                disabled={!selectedVet}
              />
              <p className="text-sm text-gray-600">
                {!selectedVet 
                  ? "Please select a veterinarian first"
                  : "Bookings available from tomorrow onwards"}
              </p>
            </div>

            {/* Select Time */}
            <div className="space-y-2">
              <Label>Select Time</Label>
              <Select 
                value={selectedTime} 
                onValueChange={setSelectedTime}
                disabled={!selectedVet || !selectedDate}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !selectedVet 
                      ? "Select a veterinarian first" 
                      : !selectedDate 
                        ? "Select a date first" 
                        : getAvailableTimeSlots().length === 0
                          ? "No available slots for this day"
                          : "Choose a time slot"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableTimeSlots().length > 0 ? (
                    getAvailableTimeSlots().map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-slots" disabled>
                      No available time slots
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {selectedVet && selectedDate && getAvailableTimeSlots().length > 0 && (
                <p className="text-sm text-green-600">
                  {getAvailableTimeSlots().length} time slot{getAvailableTimeSlots().length > 1 ? 's' : ''} available
                </p>
              )}
              {selectedVet && selectedDate && getAvailableTimeSlots().length === 0 && (
                <p className="text-sm text-orange-600">
                  No available slots on this day. Please select another date.
                </p>
              )}
            </div>

            {/* Additional Notes */}
            <div className="space-y-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <ImageIcon className="size-5" />
                </div>
                <div>
                  <Label htmlFor="consultConcernImages" className="font-semibold text-slate-900">
                    Pictures of Concern (Optional)
                  </Label>
                  <p className="mt-1 text-xs text-slate-500">
                    Upload clear photos of symptoms, wounds, skin issues, or other visible concerns.
                  </p>
                </div>
              </div>

              <label
                htmlFor="consultConcernImages"
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-8 text-center transition-colors hover:border-blue-400"
              >
                <Upload className="mb-3 size-10 text-slate-400" />
                <span className="text-sm font-semibold text-blue-600">Click to upload concern photos</span>
                <span className="mt-1 text-xs text-slate-400">PNG or JPG images only</span>
                <Input
                  id="consultConcernImages"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleConcernImageUpload}
                  className="hidden"
                />
              </label>

              {concernImages.length > 0 && (
                <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-4">
                  {concernImages.map((image, index) => (
                    <div key={`${image}-${index}`} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <img src={image} alt={`Concern ${index + 1}`} className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveConcernImage(index)}
                        className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white shadow hover:bg-red-600"
                        aria-label="Remove concern photo"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Describe any specific concerns or symptoms..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            <div className="pt-4 border-t">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                <span className="text-lg font-semibold">Consultation Fee</span>
                <span className="text-2xl font-bold text-blue-600">₱500</span>
              </div>
              <Button type="submit" className="w-full" size="lg">
                Continue to Payment
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
