import { useState, useEffect } from "react";
import { useNavigate } from "./dashboardRouter";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { Input } from "../../ui/input";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import { Checkbox } from "../../ui/checkbox";
import { toast } from "../../reusecomponent/toast.jsx";
import { ArrowLeft, Hotel, Home, Check, X, PawPrint } from "lucide-react";
import { differenceInDays, parseISO } from "../../lib/date";

export default function PetHotel() {
  const navigate = useNavigate();
  const [pets, setPets] = useState([]);
  const [serviceType, setServiceType] = useState("hotel");
  const [selectedPets, setSelectedPets] = useState([]);
  const [roomSize, setRoomSize] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [addOns, setAddOns] = useState([]);
  const [specialRequests, setSpecialRequests] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  // New Pet Information (for anonymous booking)
  const [isNewPet, setIsNewPet] = useState(false);
  const [newPetName, setNewPetName] = useState("");
  const [newPetSpecies, setNewPetSpecies] = useState("");
  const [newPetBreed, setNewPetBreed] = useState("");
  const [newPetAge, setNewPetAge] = useState("");
  const [newPetWeight, setNewPetWeight] = useState("");
  const [newPetMedicalConditions, setNewPetMedicalConditions] = useState("");

  const roomSizes = {
    hotel: [
      {
        id: "small",
        name: "Small Room",
        capacity: "1 pet",
        price: "₱600/day",
        features: ["Climate controlled", "Comfortable bedding", "2 meals/day", "Daily cleaning"]
      },
      {
        id: "medium",
        name: "Medium Room",
        capacity: "1-2 pets",
        price: "₱1,200/day",
        features: ["Spacious area", "Comfortable bedding", "3 meals/day", "Play area access", "TV entertainment"]
      },
      {
        id: "large",
        name: "Large Room",
        capacity: "2-3 pets",
        price: "₱2,000/day",
        features: ["Extra large space", "Quality bedding", "Deluxe meals", "Private play area", "24/7 camera access", "Daily grooming"]
      }
    ],
    boarding: [
      {
        id: "small",
        name: "Small Kennel",
        capacity: "1 pet",
        price: "₱400/day",
        features: ["Secure kennel", "Basic bedding", "2 meals/day", "Outdoor time"]
      },
      {
        id: "medium",
        name: "Medium Kennel",
        capacity: "1-2 pets",
        price: "₱800/day",
        features: ["Spacious kennel", "Comfortable bedding", "3 meals/day", "Extended outdoor time", "Socialization"]
      },
      {
        id: "large",
        name: "Large Kennel",
        capacity: "2-3 pets",
        price: "₱1,400/day",
        features: ["Extra large kennel", "Premium bedding", "Premium meals", "Extended play sessions", "Training activities"]
      }
    ]
  };

  const addOnServices = [
    { id: "behavior", name: "Behavior Observation", price: "₱300/day", icon: Check },
    { id: "playtime", name: "Extra Playtime (1hr)", price: "₱200/day", icon: Check },
    { id: "training", name: "Basic Training Session", price: "₱500/session", icon: Check },
    { id: "photos", name: "Daily Photo Updates", price: "₱150/day", icon: Check },
    { id: "medication", name: "Medication Administration", price: "₱200/day", icon: Check },
    { id: "special-diet", name: "Special Diet Meals", price: "₱250/day", icon: Check }
  ];

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const user = users.find((u) => u.id === currentUser.id);
    
    if (user && user.pets) {
      setPets(user.pets);
    }

    // Pre-fill emergency contact
    if (user.phone) {
      setEmergencyContact(user.phone);
    }
  }, []);

  const toggleAddOn = (addOnId) => {
    setAddOns(prev =>
      prev.includes(addOnId)
        ? prev.filter(a => a !== addOnId)
        : [...prev, addOnId]
    );
  };

  const calculateStayDuration = () => {
    if (checkInDate && checkOutDate) {
      const days = differenceInDays(parseISO(checkOutDate), parseISO(checkInDate));
      return days > 0 ? days : 0;
    }
    return 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (selectedPets.length === 0) {
      toast.error("Please select at least one pet");
      return;
    }
    if (!roomSize) {
      toast.error("Please select a room size");
      return;
    }
    if (!checkInDate) {
      toast.error("Please select check-in date");
      return;
    }
    if (!checkOutDate) {
      toast.error("Please select check-out date");
      return;
    }
    if (new Date(checkOutDate) <= new Date(checkInDate)) {
      toast.error("Check-out date must be after check-in date");
      return;
    }
    if (!emergencyContact.trim()) {
      toast.error("Please provide an emergency contact number");
      return;
    }

    const stayDuration = calculateStayDuration();
    if (stayDuration < 1) {
      toast.error("Minimum stay is 1 day");
      return;
    }

    // Save booking to localStorage
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const userIndex = users.findIndex((u) => u.id === currentUser.id);

    if (userIndex !== -1) {
      const selectedRoom = roomSizes[serviceType].find(r => r.id === roomSize);
      const selectedAddOns = addOns.map(id => 
        addOnServices.find(a => a.id === id)?.name || ""
      ).join(", ");

      const booking = {
        id: `pet-hotel-${Date.now()}`,
        type: serviceType === "hotel" ? "Pet Hotel" : "Pet Boarding",
        serviceType: serviceType,
        petIds: selectedPets,
        petNames: selectedPets.map(id => pets.find(p => p.id === id)?.name).join(", "),
        roomSize: selectedRoom?.name,
        roomPrice: selectedRoom?.price,
        checkInDate,
        checkOutDate,
        stayDuration,
        addOns: addOns,
        addOnNames: selectedAddOns,
        specialRequests,
        emergencyContact,
        status: "Pending Review",
        createdAt: new Date().toISOString(),
      };

      if (!users[userIndex].serviceBookings) {
        users[userIndex].serviceBookings = [];
      }
      users[userIndex].serviceBookings.push(booking);

      localStorage.setItem("users", JSON.stringify(users));
      localStorage.setItem("currentUser", JSON.stringify(users[userIndex]));

      toast.success(`${serviceType === "hotel" ? "Pet hotel" : "Pet boarding"} booking submitted! Waiting for admin approval.`);
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
              You need to register at least one pet before booking pet hotel services.
            </p>
            <Button onClick={() => navigate("/dashboard/my-pets/add")}>
              Add Your First Pet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stayDuration = calculateStayDuration();

  return (
    <div className="space-y-6 lg:space-y-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/dashboard/services")} className="self-start">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Pet Hotel & Boarding</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Booking Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Service Type Selection */}
            <div className="space-y-3">
              <Label>Service Type *</Label>
              <div className="grid grid-cols-2 gap-4">
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    serviceType === "hotel"
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => {
                    setServiceType("hotel");
                    setRoomSize("");
                  }}
                >
                  <Hotel className={`h-8 w-8 mb-2 ${serviceType === "hotel" ? 'text-blue-600' : 'text-gray-600'}`} />
                  <h4 className="font-bold mb-1">Pet Hotel</h4>
                  <p className="text-sm text-gray-600">Premium rooms with comfort amenities</p>
                </div>
                <div
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    serviceType === "boarding"
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => {
                    setServiceType("boarding");
                    setRoomSize("");
                  }}
                >
                  <Home className={`h-8 w-8 mb-2 ${serviceType === "boarding" ? 'text-blue-600' : 'text-gray-600'}`} />
                  <h4 className="font-bold mb-1">Pet Boarding</h4>
                  <p className="text-sm text-gray-600">Secure kennels with daily care</p>
                </div>
              </div>
            </div>

            {/* Select Pet(s) with multi-select */}
            <div className="space-y-3">
              <Label>Select Pet(s) * (Maximum 3, same species only)</Label>
              <p className="text-sm text-gray-600">Note: All pets must be the same type (e.g., all dogs or all cats)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pets.map((pet) => {
                  const isSelected = selectedPets.includes(pet.id);
                  const firstSelectedPet = selectedPets.length > 0 ? pets.find(p => p.id === selectedPets[0]) : null;
                  const isDisabled = selectedPets.length > 0 && !isSelected && firstSelectedPet && firstSelectedPet.species !== pet.species;
                  
                  return (
                    <Card
                      key={pet.id}
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? "border-2 border-blue-600 bg-blue-50 shadow-lg scale-105"
                          : isDisabled
                          ? "opacity-50 cursor-not-allowed border-2 border-gray-200"
                          : "border-2 border-gray-200 hover:border-gray-300 hover:shadow-lg hover:scale-105"
                      }`}
                      onClick={() => {
                        if (isDisabled) {
                          toast.error("All pets must be the same species");
                          return;
                        }
                        if (isSelected) {
                          setSelectedPets(selectedPets.filter(id => id !== pet.id));
                        } else {
                          if (selectedPets.length < 3) {
                            setSelectedPets([...selectedPets, pet.id]);
                          } else {
                            toast.error("Maximum 3 pets allowed");
                          }
                        }
                      }}
                    >
                      <CardContent className="pt-6 relative">
                        {isSelected && (
                          <div className="absolute top-3 right-3 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        )}
                        <div className="text-center">
                          {pet.profileImage ? (
                            <img
                              src={pet.profileImage}
                              alt={pet.name}
                              className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-4 border-blue-100"
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center mx-auto mb-3">
                              <PawPrint className="h-10 w-10 text-white" />
                            </div>
                          )}
                          <h3 className="font-bold text-gray-900 mb-1">{pet.name}</h3>
                          <p className="text-sm text-gray-600">{pet.species} • {pet.breed}</p>
                          {pet.age && (
                            <p className="text-xs text-gray-500 mt-1">{pet.age} years old</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {selectedPets.length > 0 && (
                <p className="text-sm text-blue-600 font-medium">
                  {selectedPets.length} pet{selectedPets.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Room Size Selection */}
            <div className="space-y-3">
              <Label>Select Room Size *</Label>
              <RadioGroup value={roomSize} onValueChange={setRoomSize}>
                <div className="grid md:grid-cols-3 gap-4">
                  {roomSizes[serviceType].map((room) => (
                    <div key={room.id}>
                      <div
                        className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          roomSize === room.id
                            ? "border-blue-600 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => setRoomSize(room.id)}
                      >
                        <RadioGroupItem
                          value={room.id}
                          id={room.id}
                          className="absolute top-4 right-4"
                        />
                        <div className="mb-3">
                          <Hotel className={`h-8 w-8 mb-2 ${roomSize === room.id ? 'text-blue-600' : 'text-gray-600'}`} />
                          <h4 className="font-bold mb-1">{room.name}</h4>
                          <p className="text-sm text-gray-600 mb-2">Capacity: {room.capacity}</p>
                          <p className="font-bold text-blue-600">{room.price}</p>
                        </div>
                        <ul className="space-y-1">
                          {room.features.map((feature, idx) => (
                            <li key={idx} className="text-xs text-gray-600 flex items-center gap-1">
                              <Check className="h-3 w-3 text-green-600" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Check-in and Check-out Dates */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkInDate">Check-in Date *</Label>
                <Input
                  id="checkInDate"
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkOutDate">Check-out Date *</Label>
                <Input
                  id="checkOutDate"
                  type="date"
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  min={checkInDate || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {stayDuration > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900">
                  Duration: <span className="font-bold">{stayDuration} day{stayDuration !== 1 ? 's' : ''}</span>
                </p>
              </div>
            )}

            {/* Add-on Services */}
            <div className="space-y-3">
              <Label>Add-on Services (Optional)</Label>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {addOnServices.map((addOn) => {
                  const Icon = addOn.icon;
                  const isSelected = addOns.includes(addOn.id);
                  return (
                    <div
                      key={addOn.id}
                      onClick={() => toggleAddOn(addOn.id)}
                      className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {isSelected ? (
                            <div className="w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          ) : (
                            <div className="w-4 h-4 border-2 border-gray-300 rounded" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm">{addOn.name}</h4>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Emergency Contact Number *</Label>
              <Input
                id="emergencyContact"
                type="tel"
                placeholder="+63 XXX XXX XXXX"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
              />
            </div>

            {/* Special Requests */}
            <div className="space-y-2">
              <Label htmlFor="specialRequests">Special Requests (Optional)</Label>
              <Textarea
                id="specialRequests"
                placeholder="Dietary restrictions, medications, behavioral notes, etc..."
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                rows={4}
              />
            </div>

            {/* Important Notice */}
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="pt-4">
                <h4 className="font-semibold text-amber-900 mb-2">📋 Booking Policy</h4>
                <ul className="space-y-1 text-sm text-amber-800">
                  <li>• Your booking requires admin approval and availability confirmation</li>
                  <li>• We will call you to confirm the delivery schedule of your pet to the clinic</li>
                  <li>• Pet drop-off and pick-up must be during clinic working hours (8:00 AM - 6:00 PM)</li>
                  <li>• Payment is due upon check-in or after booking approval</li>
                  <li>• Valid vaccination records required at check-in</li>
                  <li>• Personal belongings (toys, bedding) are welcome</li>
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

