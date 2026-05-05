import { useState, useEffect } from "react";
import { useNavigate } from "./dashboardRouter";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group";
import { Textarea } from "../../ui/textarea";
import { Input } from "../../ui/input";
import { toast } from "../../reusecomponent/toast.jsx";
import { ArrowLeft, Hotel, Home, Check, PawPrint } from "lucide-react";
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

    if (user && user.phone) {
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

            {/* Select Pet(s) */}
            <div className="space-y-3">
              <Label>Select Pet(s) * (Maximum 3)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pets.map((pet) => {
                  const isSelected = selectedPets.includes(pet.id);
                  return (
                    <Card
                      key={pet.id}
                      className={`cursor-pointer transition-all ${
                        isSelected ? "border-2 border-blue-600 bg-blue-50" : "border-2 border-gray-200"
                      }`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedPets(selectedPets.filter(id => id !== pet.id));
                        } else {
                          if (selectedPets.length < 3) setSelectedPets([...selectedPets, pet.id]);
                          else toast.error("Maximum 3 pets allowed");
                        }
                      }}
                    >
                      <CardContent className="pt-6 text-center">
                        <PawPrint className="mx-auto mb-2" />
                        <h3 className="font-bold">{pet.name}</h3>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Room Size Selection */}
            <div className="space-y-3">
              <Label>Select Room Size *</Label>
              <RadioGroup value={roomSize} onValueChange={setRoomSize}>
                <div className="grid md:grid-cols-3 gap-4">
                  {roomSizes[serviceType].map((room) => (
                    <div key={room.id} onClick={() => setRoomSize(room.id)} className={`p-4 border-2 rounded-lg cursor-pointer ${roomSize === room.id ? "border-blue-600 bg-blue-50" : "border-gray-200"}`}>
                      <h4 className="font-bold">{room.name}</h4>
                      <p className="text-sm text-gray-600">{room.price}</p>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Dates, Contact, Submit */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkInDate">Check-in Date *</Label>
                <Input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} required min={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkOutDate">Check-out Date *</Label>
                <Input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} required min={checkInDate || new Date().toISOString().split('T')[0]} />
              </div>
            </div>

            <Button type="submit" className="w-full" size="lg">Submit Booking</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
