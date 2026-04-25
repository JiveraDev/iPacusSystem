import { useState, useEffect } from "react";
import { useNavigate } from "./dashboardRouter";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { Input } from "../../ui/input";
import { Checkbox } from "../../ui/checkbox";
import { toast } from "./toast";
import { ArrowLeft, Bath, Scissors, Syringe, Heart, Stethoscope, Pill, Check } from "lucide-react";

export default function HomeServices() {
  const navigate = useNavigate();
  const [pets, setPets] = useState([]);
  const [selectedPet, setSelectedPet] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);
  const [preferredDate, setPreferredDate] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  // New Pet Information (for anonymous booking)
  const [isNewPet, setIsNewPet] = useState(false);
  const [newPetName, setNewPetName] = useState("");
  const [newPetSpecies, setNewPetSpecies] = useState("");
  const [newPetBreed, setNewPetBreed] = useState("");
  const [newPetAge, setNewPetAge] = useState("");
  const [newPetWeight, setNewPetWeight] = useState("");
  const [newPetMedicalConditions, setNewPetMedicalConditions] = useState("");

  const homeServices = [
    {
      id: "grooming-full",
      name: "Grooming",
      description: "Bath, haircut, nail trim, ear cleaning",
      price: "₱800 - ₱1,500",
      icon: Scissors,
      color: "text-blue-600",
      includes: ["nail-trim"]
    },
    {
      id: "nail-trim",
      name: "Nail Trimming",
      description: "Nail care and filing",
      price: "₱200 - ₱400",
      icon: Scissors,
      color: "text-orange-600",
      isSubService: true
    },
    {
      id: "bathing",
      name: "Bathing & Blow Dry",
      description: "Bath with quality products",
      price: "₱400 - ₱800",
      icon: Bath,
      color: "text-cyan-600"
    },
    {
      id: "wellness-check",
      name: "Wellness Check-up",
      description: "Complete physical examination",
      price: "₱500 - ₱800",
      icon: Stethoscope,
      color: "text-purple-600",
      includes: ["vaccination", "medication"]
    },
    {
      id: "vaccination",
      name: "Vaccinations",
      description: "Core vaccines, rabies, and boosters",
      price: "₱300 - ₱1,000",
      icon: Syringe,
      color: "text-green-600",
      isSubService: true
    },
    {
      id: "medication",
      name: "Medication Administration",
      description: "Medication delivery",
      price: "₱300 - ₱500",
      icon: Pill,
      color: "text-red-600",
      isSubService: true
    },
    {
      id: "wound-care",
      name: "Wound Care",
      description: "Cleaning and dressing of minor wounds",
      price: "₱500 - ₱1,000",
      icon: Heart,
      color: "text-pink-600"
    },
    {
      id: "ear-cleaning",
      name: "Ear Cleaning",
      description: "Ear hygiene service",
      price: "₱200 - ₱400",
      icon: Stethoscope,
      color: "text-indigo-600"
    }
  ];

  const timeSlots = [
    "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
  ];

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const user = users.find((u) => u.id === currentUser.id);
    
    if (user && user.pets) {
      setPets(user.pets);
    }

    // Pre-fill address from user profile
    if (user.address) {
      setAddress(user.address);
    }
  }, []);

  const toggleService = (serviceId) => {
    const service = homeServices.find(s => s.id === serviceId);
    
    setSelectedServices(prev => {
      if (prev.includes(serviceId)) {
        // Unchecking a service
        if (service?.includes) {
          // If unchecking a parent service, also uncheck its sub-services
          return prev.filter(s => s !== serviceId && !service.includes.includes(s));
        }
        
        // Just uncheck the service (sub-services don't affect parent)
        return prev.filter(s => s !== serviceId);
      } else {
        // Checking a service
        if (service?.includes) {
          // If checking a parent service, also check its sub-services
          return [...prev, serviceId, ...service.includes];
        }
        
        // Just check the service
        return [...prev, serviceId];
      }
    });
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
    
    if (selectedServices.length === 0) {
      toast.error("Please select at least one service");
      return;
    }
    if (!preferredDate) {
      toast.error("Please select a preferred date");
      return;
    }
    if (!address.trim()) {
      toast.error("Please enter your service address");
      return;
    }

    // Save booking to localStorage
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const userIndex = users.findIndex((u) => u.id === currentUser.id);

    if (userIndex !== -1) {
      const pet = isNewPet ? null : pets.find(p => p.id === selectedPet);
      const serviceNames = selectedServices.map(id => 
        homeServices.find(s => s.id === id)?.name || ""
      ).join(", ");

      const booking = {
        id: `home-service-${Date.now()}`,
        type: "Home Service",
        petId: isNewPet ? "new-pet" : selectedPet,
        petName: isNewPet ? newPetName : pet?.name,
        petSpecies: isNewPet ? newPetSpecies : pet?.species,
        petBreed: isNewPet ? newPetBreed : pet?.breed,
        petAge: isNewPet ? newPetAge : pet?.age,
        petWeight: isNewPet ? newPetWeight : pet?.weight,
        petMedicalConditions: isNewPet ? newPetMedicalConditions : "",
        services: selectedServices,
        serviceNames: serviceNames,
        preferredDate,
        address,
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

      toast.success("Home service booking submitted! Waiting for admin approval.");
      navigate("/dashboard/services");
    }
  };

  if (pets.length === 0) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <Button variant="ghost" onClick={() => navigate("/dashboard/services")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Services
        </Button>
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <h3 className="font-semibold text-lg mb-2">No Pets Registered</h3>
            <p className="text-gray-600 mb-4">
              You need to register at least one pet before booking home services.
            </p>
            <Button onClick={() => navigate("/dashboard/my-pets/add")}>
              Add Your First Pet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/dashboard/services")} className="self-start">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Book Home Service</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Select Pet */}
            <div className="space-y-2">
              <Label>Select Pet *</Label>
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
                    <SelectItem key={pet.id} value={pet.id}>
                      {pet.name} ({pet.species} - {pet.breed})
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

            {/* Select Services */}
            <div className="space-y-3">
              <Label>Select Services *</Label>
              <div className="grid sm:grid-cols-2 gap-3">
                {homeServices.map((service) => {
                  const Icon = service.icon;
                  const isSelected = selectedServices.includes(service.id);
                  return (
                    <div
                      key={service.id}
                      onClick={() => toggleService(service.id)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          {isSelected ? (
                            <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 border-2 border-gray-300 rounded" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`h-4 w-4 ${service.color}`} />
                            <h4 className="font-semibold text-sm">{service.name}</h4>
                          </div>
                          <p className="text-xs text-gray-600 mb-1">{service.description}</p>
                          <p className="text-xs font-medium text-blue-600">{service.price}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Preferred Date */}
            <div className="space-y-2">
              <Label htmlFor="preferredDate">Preferred Date *</Label>
              <Input
                id="preferredDate"
                type="date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Service Address */}
            <div className="space-y-2">
              <Label htmlFor="address">Service Address *</Label>
              <Textarea
                id="address"
                placeholder="Enter your complete address where the service will be performed"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
              />
            </div>

            {/* Additional Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any special instructions or concerns..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Important Notice */}
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="pt-4">
                <h4 className="font-semibold text-amber-900 mb-2">⚠️ Important Notice</h4>
                <ul className="space-y-1 text-sm text-amber-800">
                  <li>• Your booking will be reviewed by our admin team</li>
                  <li>• Payment will be collected after approval and service completion</li>
                  <li>• You will receive a confirmation notification after reviewed</li>
                  <li>• Home service fees may vary based on location and pet size</li>
                </ul>
              </CardContent>
            </Card>

            <Button type="submit" className="w-full" size="lg">
              Submit Booking for Review
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

