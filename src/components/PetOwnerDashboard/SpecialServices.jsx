import { useState, useEffect } from "react";
import { useNavigate } from "./dashboardRouter";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { Input } from "../../ui/input";
import { toast } from "../../reusecomponent/toast.jsx";
import { ArrowLeft, Scissors, Activity, Check } from "lucide-react";

export default function SpecialServices() {
  const navigate = useNavigate();
  const [pets, setPets] = useState([]);
  const [selectedPets, setSelectedPets] = useState([]);
  const [serviceType, setServiceType] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [notes, setNotes] = useState("");

  // New Pet Information (for anonymous booking)
  const [isNewPet, setIsNewPet] = useState(false);
  const [newPetName, setNewPetName] = useState("");
  const [newPetSpecies, setNewPetSpecies] = useState("");
  const [newPetAge, setNewPetAge] = useState("");
  const [newPetWeight, setNewPetWeight] = useState("");
  const [newPetMedicalConditions, setNewPetMedicalConditions] = useState("");

  const specialServices = [
    {
      id: "kapon",
      name: "Kapon (Spay/Neuter)",
      description: "Surgical sterilization procedure",
      icon: Scissors,
      color: "text-blue-600",
      veterinarian: "Dr. Maria Santos",
      maxPets: 3,
      price: "Free",
      duration: "2-3 hours per pet"
    },
    {
      id: "special-surgery",
      name: "Special Surgery",
      description: "Specialized surgical procedures",
      icon: Activity,
      color: "text-red-600",
      veterinarian: "Dr. Juan Cruz",
      maxPets: 2,
      price: "₱5,000 - ₱15,000",
      duration: "3-5 hours per pet"
    }
  ];

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const user = users.find((u) => u.id === currentUser.id);
    

  }, []);

  const handlePetToggle = (petId) => {
    const selectedService = specialServices.find(s => s.id === serviceType);
    if (!selectedService) {
      toast.error("Please select a service type first");
      return;
    }

    // Don't allow toggling if it's the new-pet placeholder
    if (petId === "new-pet") {
      return;
    }

    setSelectedPets(prev => {
      if (prev.includes(petId)) {
        return prev.filter(id => id !== petId);
      } else {
        if (prev.length >= selectedService.maxPets) {
          toast.error(`Maximum ${selectedService.maxPets} pets allowed for this service`);
          return prev;
        }
        return [...prev, petId];
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (selectedPets.length === 0 && !isNewPet) {
      toast.error("Please select at least one pet or add new pet information");
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
      if (!newPetAge) {
        toast.error("Please enter the pet's age");
        return;
      }
    }

    if (!serviceType) {
      toast.error("Please select a service type");
      return;
    }
    if (!serviceDate) {
      toast.error("Please select the exact service date");
      return;
    }

    // Save booking to localStorage
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const userIndex = users.findIndex((u) => u.id === currentUser.id);

    if (userIndex !== -1) {
      const service = specialServices.find(s => s.id === serviceType);
      
      let petsData;
      if (isNewPet) {
        petsData = [{
          id: "new-pet",
          name: newPetName,
          species: newPetSpecies,
          age: newPetAge,
          weight: newPetWeight,
          medicalConditions: newPetMedicalConditions
        }];
      } else {
        const selectedPetDetails = pets.filter(p => selectedPets.includes(p.id));
        petsData = selectedPetDetails.map(pet => ({ id: pet.id, name: pet.name, species: pet.species }));
      }

      const booking = {
        id: `special-service-${Date.now()}`,
        type: "Special Service",
        serviceType: service?.name,
        veterinarian: service?.veterinarian,
        pets: petsData,
        petCount: petsData.length,
        serviceDate,
        notes,
        status: "Pending Review",
        createdAt: new Date().toISOString(),
      };

      if (!users[userIndex].serviceBookings) {
        users[userIndex].serviceBookings = [];
      }
      users[userIndex].serviceBookings.push(booking);

      localStorage.setItem("users", JSON.stringify(users));
      localStorage.setItem("currentUser", JSON.stringify(users[userIndex]));

      toast.success("Special service request submitted! Our team will contact you soon.");
      navigate("/dashboard/services");
    }
  };

  const selectedService = specialServices.find(s => s.id === serviceType);

  return (
    <div className="space-y-6 lg:space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/dashboard/services")} className="self-start">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Special Services</h1>
        </div>
      </div>

      {/* Service Options */}
      <div className="grid sm:grid-cols-2 gap-4">
        {specialServices.map((service) => {
          const Icon = service.icon;
          const isSpecialSurgery = service.id === "special-surgery";
          return (
            <Card 
              key={service.id}
              className={`transition-all ${ 
                isSpecialSurgery 
                  ? "opacity-60 cursor-not-allowed" 
                  : serviceType === service.id 
                    ? "ring-2 ring-blue-600 shadow-lg cursor-pointer" 
                    : "hover:shadow-md cursor-pointer"
              }`}
              onClick={() => {
                if (!isSpecialSurgery) {
                  setServiceType(service.id);
                  setSelectedPets([]);
                }
              }}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Icon className={`h-10 w-10 ${service.color} flex-shrink-0`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-lg">{service.name}</h4>
                      {isSpecialSurgery && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-semibold">
                          Unavailable
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{service.description}</p>
                    <div className="space-y-1 text-sm">
                      <p className="text-gray-700"><span className="font-semibold">Price:</span> {service.price}</p>
                      <p className="text-gray-700"><span className="font-semibold">Duration:</span> {service.duration}</p>
                      <p className="text-gray-700"><span className="font-semibold">Veterinarian:</span> {service.veterinarian}</p>
                      <p className="text-gray-700"><span className="font-semibold">Max Pets:</span> {service.maxPets}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Booking Form */}
      {serviceType && (
        <Card>
          <CardHeader>
            <CardTitle>Service Booking Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* New Pet Information Form */}
              {isNewPet && (
                <div className="space-y-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-blue-900">New Pet Information</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsNewPet(false)}
                    >
                      Cancel
                    </Button>
                  </div>
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

              {/* Select Pets (only show if not new pet) */}
              {!isNewPet && (
                <div className="space-y-3">
                  <Label>
                    Select Pet(s) * 
                    {selectedService && ` (Max: ${selectedService.maxPets})`}
                  </Label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {pets.map((pet) => {
                      const isSelected = selectedPets.includes(pet.id);
                      return (
                        <div
                          key={pet.id}
                          onClick={() => handlePetToggle(pet.id)}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? "border-blue-600 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              {isSelected ? (
                                <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                                  <Check className="h-3 w-3 text-white" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 border-2 border-gray-300 rounded" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold">{pet.name}</h4>
                              <p className="text-sm text-gray-600">{pet.species} - {pet.breed}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* New Pet Option */}
                    <div
                      onClick={() => setIsNewPet(true)}
                      className="p-4 border-2 border-dashed border-blue-400 rounded-lg cursor-pointer transition-all hover:border-blue-600 hover:bg-blue-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-5 h-5 border-2 border-blue-500 rounded flex items-center justify-center">
                            <span className="text-blue-600 font-bold text-lg leading-none">+</span>
                          </div>
                        </div>
                        <div>
                          <h4 className="font-semibold text-blue-600">🐾 New Pet</h4>
                          <p className="text-sm text-gray-600">(Not Registered)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Exact Service Date */}
              <div className="space-y-2">
                <Label htmlFor="serviceDate">Announced Service Date *</Label>
                <Input
                  id="serviceDate"
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="text-sm text-gray-600">
                  Select from the announced available dates when the service will be conducted. The clinic announces specific dates for special services.
                </p>
              </div>

              {/* Additional Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special instructions, health concerns, or questions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Important Notice */}
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="pt-4">
                  <h4 className="font-semibold text-amber-900 mb-2">⚠️ Important Notice</h4>
                  <ul className="space-y-1 text-sm text-amber-800">
                    <li>• Your booking requires admin approval before the service can be scheduled</li>
                    <li>• Our team will contact you to confirm the exact time and preparation instructions</li>
                    <li>• Payment will be discussed after approval and before the service date</li>
                    <li>• Please ensure your pet is fasting if required (admin will advise)</li>
                  </ul>
                </CardContent>
              </Card>

              <Button type="submit" className="w-full" size="lg">
                Submit Service Request
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

