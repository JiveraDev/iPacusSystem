import { useState, useEffect } from "react";
import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { Input } from "../../ui/input";
import { toast } from "../../reusecomponent/toast.jsx";
import { ArrowLeft } from "lucide-react";
import { addDays, format } from "../../lib/date";

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

  // New Pet Information (for anonymous booking)
  const [isNewPet, setIsNewPet] = useState(false);
  const [newPetName, setNewPetName] = useState("");
  const [newPetSpecies, setNewPetSpecies] = useState("");
  const [newPetBreed, setNewPetBreed] = useState("");
  const [newPetAge, setNewPetAge] = useState("");
  const [newPetWeight, setNewPetWeight] = useState("");
  const [newPetMedicalConditions, setNewPetMedicalConditions] = useState("");

  // Fallback availability for veterinarians
  const defaultAvailability = {
    monday: ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"],
    tuesday: ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"],
    wednesday: ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"],
    thursday: ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"],
    friday: ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"],
    saturday: ["09:00 AM", "10:00 AM", "11:00 AM"],
    sunday: []
  };

  const discussionTopics = ["Weight Issues", "Symptoms/Illness", "Behavior", "Nutrition", "Other"];

  // Get available time slots for selected vet and date
  const getAvailableTimeSlots = () => {
    if (!selectedVet || !selectedDate) return [];
    
    const vet = veterinarians.find(v => v.id === selectedVet);
    if (!vet) return [];

    const date = new Date(selectedDate);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // Use vet-specific availability if it exists, otherwise use default
    return (vet.availability && vet.availability[dayName]) || defaultAvailability[dayName] || [];
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const userId = currentUser.id || currentUser.user_id;

        // Fetch Pets
        const petsResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/users/${userId}/pets`);
        const petsData = await petsResponse.json();
        setPets(Array.isArray(petsData) ? petsData : []);

        // Fetch Veterinarians
        const vetsResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/accounts`);
        const vetsData = await vetsResponse.json();
        
        if (vetsData && vetsData.veterinarians) {
          const formattedVets = vetsData.veterinarians.map(v => ({
            id: v.user_id,
            name: `Dr. ${v.first_Name} ${v.last_Name}`,
            specialization: v.specialization || "General Practice",
            availability: defaultAvailability // Currently the DB doesn't store availability, so use default
          }));
          setVeterinarians(formattedVets);
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

    // Store booking data in session storage
    const bookingData = {
      petId: isNewPet ? "new-pet" : selectedPet,
      petName: isNewPet ? newPetName : pets.find(p => (p.id === selectedPet || p.pet_id === selectedPet))?.name || pets.find(p => (p.id === selectedPet || p.pet_id === selectedPet))?.pet_name,
      petSpecies: isNewPet ? newPetSpecies : pets.find(p => (p.id === selectedPet || p.pet_id === selectedPet))?.species || pets.find(p => (p.id === selectedPet || p.pet_id === selectedPet))?.pet_species,
      petBreed: isNewPet ? newPetBreed : pets.find(p => (p.id === selectedPet || p.pet_id === selectedPet))?.breed || pets.find(p => (p.id === selectedPet || p.pet_id === selectedPet))?.pet_breed,
      petAge: isNewPet ? newPetAge : pets.find(p => (p.id === selectedPet || p.pet_id === selectedPet))?.age || pets.find(p => (p.id === selectedPet || p.pet_id === selectedPet))?.pet_age,
      petWeight: isNewPet ? newPetWeight : pets.find(p => (p.id === selectedPet || p.pet_id === selectedPet))?.weight || pets.find(p => (p.id === selectedPet || p.pet_id === selectedPet))?.pet_weight,
      petMedicalConditions: isNewPet ? newPetMedicalConditions : "",
      discussionTopic: discussionTopic.join(", "),
      notes,
      date: format(new Date(selectedDate), "yyyy-MM-dd"),
      time: selectedTime,
      veterinarianId: selectedVet,
      veterinarian: veterinarians.find(v => v.id === selectedVet)?.name,
      dateTime: `${format(new Date(selectedDate), "yyyy-MM-dd")} ${selectedTime}`,
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
                  <SelectValue placeholder="Choose your pet" />
                </SelectTrigger>
                <SelectContent>
                  {pets.map((pet) => (
                    <SelectItem key={pet.id || pet.pet_id} value={pet.id || pet.pet_id}>
                      {pet.name || pet.pet_name} ({pet.species || pet.pet_species} - {pet.breed || pet.pet_breed})
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
                  <SelectValue placeholder="Choose a veterinarian" />
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
                  View {veterinarians.find(v => v.id === selectedVet)?.name}'s available time slots below
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
                min={addDays(new Date(), 1).toISOString().split('T')[0]}
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

