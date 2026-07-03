import { useState, useEffect } from "react";
import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Textarea } from "../../ui/textarea";
import { Input } from "../../ui/input";
import { Checkbox } from "../../ui/checkbox";
import { toast } from "../../reusecomponent/toast.jsx";
import { 
  ArrowLeft, Bath, Scissors, Syringe, Heart, Stethoscope, Pill, Check, 
  Upload, X, Image as ImageIcon, MapPin, Search, Loader2 
} from "lucide-react";
import { searchAddresses } from "../../services/addressAutocomplete";
import { DECEASED_PET_BOOKING_MESSAGE, getPetSelectLabel, getPetStatus, isPetDeceased } from "../../lib/petStatus";
import { fetchUserPets } from "../../services/petService";

export default function HomeServices() {
  const navigate = useNavigate();
  const [pets, setPets] = useState([]);
  const [isLoadingPets, setIsLoadingPets] = useState(true);
  const [selectedPet, setSelectedPet] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  
  // Address State
  const [address, setAddress] = useState("");
  const [specificLocation, setSpecificLocation] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
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

  const homeServices = [
    {
      id: "grooming-full",
      name: "Grooming",
      description: "Bath, haircut, nail trim, ear cleaning",
      price: "PHP 800 - PHP 1,500",
      icon: Scissors,
      color: "text-blue-600",
      includes: ["nail-trim"]
    },
    {
      id: "nail-trim",
      name: "Nail Trimming",
      description: "Nail care and filing",
      price: "PHP 200 - PHP 400",
      icon: Scissors,
      color: "text-orange-600",
      isSubService: true
    },
    {
      id: "bathing",
      name: "Bathing & Blow Dry",
      description: "Bath with quality products",
      price: "PHP 400 - PHP 800",
      icon: Bath,
      color: "text-cyan-600"
    },
    {
      id: "general-checkup",
      name: "General Check-up",
      description: "Complete physical examination",
      price: "PHP 500 - PHP 800",
      icon: Stethoscope,
      color: "text-purple-600",
      includes: ["vaccination", "medication"]
    },
    {
      id: "vaccination",
      name: "Vaccinations",
      description: "Core vaccines, rabies, and boosters",
      price: "PHP 300 - PHP 1,000",
      icon: Syringe,
      color: "text-green-600",
      isSubService: true
    },
    {
      id: "medication",
      name: "Medication Administration",
      description: "Medication delivery",
      price: "PHP 300 - PHP 500",
      icon: Pill,
      color: "text-red-600",
      isSubService: true
    },
    {
      id: "wound-care",
      name: "Wound Care",
      description: "Cleaning and dressing of minor wounds",
      price: "PHP 500 - PHP 1,000",
      icon: Heart,
      color: "text-pink-600"
    },
    {
      id: "ear-cleaning",
      name: "Ear Cleaning",
      description: "Ear hygiene service",
      price: "PHP 200 - PHP 400",
      icon: Stethoscope,
      color: "text-indigo-600"
    }
  ];

  const timeSlots = [
    "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
  ];

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
    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setUploadedImages((prev) => [...prev, event.target.result]);
        }
      };
      reader.readAsDataURL(file);
    });
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

    if (!selectedPet) {
      toast.error("Please select a pet");
      return;
    }
    
    if (isNewPet) {
      if (!newPetName || !newPetSpecies || !newPetBreed || !newPetAge) {
        toast.error("Please fill in all required pet information");
        return;
      }
    }

    const selectedRegisteredPet = !isNewPet
      ? pets.find(p => p.db_id?.toString() === selectedPet)
      : null;

    if (isPetDeceased(selectedRegisteredPet)) {
      toast.error(DECEASED_PET_BOOKING_MESSAGE);
      return;
    }
    
    if (selectedServices.length === 0) {
      toast.error("Please select at least one service");
      return;
    }
    if (!preferredDate) {
      toast.error("Please select a preferred date");
      return;
    }
    if (!preferredTime) {
      toast.error("Please select a preferred time");
      return;
    }
    if (!address.trim()) {
      toast.error("Please enter your service address");
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
      transport_fee: 50,
      total_base_fee: 50
    };

    // Store in session for a final confirmation/payment screen
    sessionStorage.setItem("pendingHomeBooking", JSON.stringify(bookingData));
    
    toast.success("Details saved. Proceeding to final review...");
    navigate("/dashboard/consult/confirmation/home-service");
  };

  return (
    <div className="w-full max-w-4xl min-w-0 space-y-6 pb-10 lg:space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/dashboard/services")} className="self-start">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Home Service Request</h1>
          <p className="text-gray-500">Provide details for your at-home veterinary service</p>
        </div>
      </div>

      <div className="grid min-w-0 gap-8 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
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
                    <Input placeholder="Pet Name *" value={newPetName} onChange={(e) => setNewPetName(e.target.value)} />
                    <Select value={newPetSpecies} onValueChange={setNewPetSpecies}>
                      <SelectTrigger><SelectValue placeholder="Species *" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Dog">Dog</SelectItem>
                        <SelectItem value="Cat">Cat</SelectItem>
                        <SelectItem value="Bird">Bird</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Breed *" value={newPetBreed} onChange={(e) => setNewPetBreed(e.target.value)} />
                    <Input placeholder="Age *" value={newPetAge} onChange={(e) => setNewPetAge(e.target.value)} />
                    <Input placeholder="Weight (Optional)" value={newPetWeight} onChange={(e) => setNewPetWeight(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Service Grid */}
              <div className="space-y-3">
                <Label>Select Services Needed *</Label>
                <div className="responsive-grid gap-3">
                  {homeServices.map((service) => {
                    const Icon = service.icon;
                    const isSelected = selectedServices.includes(service.id);
                    return (
                      <div
                        key={service.id}
                        onClick={() => toggleService(service.id)}
                        className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                          isSelected ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? "bg-blue-600 text-white" : "bg-gray-100 " + service.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm">{service.name}</h4>
                            <p className="text-[10px] text-gray-500 truncate">{service.description}</p>
                            <p className="text-xs font-bold text-blue-600 mt-1">{service.price}</p>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="h-5 w-5 text-red-600" />
                Service Location & Time
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Preferred Date *</Label>
                  <Input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="space-y-2">
                  <Label>Preferred Time *</Label>
                  <Select value={preferredTime} onValueChange={setPreferredTime}>
                    <SelectTrigger><SelectValue placeholder="Select time slot" /></SelectTrigger>
                    <SelectContent>
                      {timeSlots.map(slot => <SelectItem key={slot} value={slot}>{slot}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Address Autocomplete */}
              <div className="space-y-2 relative">
                <Label>Service Address *</Label>
                <Input
                  placeholder="Search your address..."
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  leftIcon={<Search className="size-4" />}
                  rightIcon={isSearchingAddress ? <Loader2 className="size-4 animate-spin text-blue-600" /> : null}
                />

                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full bg-white border rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
                    {addressSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-0 flex items-start gap-3"
                        onClick={() => {
                          setAddress(suggestion.fullAddress);
                          setShowSuggestions(false);
                          setAddressSuggestions([]);
                        }}
                      >
                        <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{suggestion.label}</p>
                          <p className="text-xs text-gray-500">{suggestion.fullAddress}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Specific Location Details (Optional)</Label>
                <Input 
                  placeholder="e.g. Unit 402, Green Building, Near City Hall" 
                  value={specificLocation} 
                  onChange={(e) => setSpecificLocation(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-purple-600" />
                Photos & Additional Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Pet Photos / Concerns (Optional)</Label>
                <div className="rounded-xl border-2 border-dashed bg-gray-50/50 p-4 text-center transition-colors hover:border-blue-400 sm:p-8">
                  <input type="file" id="hsImageUpload" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                  <label htmlFor="hsImageUpload" className="cursor-pointer">
                    <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium">Click to upload photos</p>
                    <p className="text-xs text-gray-500 mt-1">Images of your pet or specific concerns help us prepare</p>
                  </label>
                </div>

                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-6">
                    {uploadedImages.map((img, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border">
                        <img src={img} className="w-full h-full object-cover" onClick={() => setViewingImage(img)} />
                        <button onClick={() => handleRemoveImage(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes for the Veterinarian</Label>
                <Textarea 
                  placeholder="Any special instructions, pet temperament, or specific concerns..." 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="lg:sticky lg:top-4">
            <CardHeader>
              <CardTitle className="text-lg">Continue to Consent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="pt-4 border-t space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Base Home Fee</span>
                  <span className="font-semibold">PHP 200</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Services</span>
                  <span className="font-semibold">Varies</span>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-[10px] text-amber-600 leading-tight">
                    * Final total will be calculated based on the distance and specific services performed. Payment is collected after the visit.
                  </p>
                </div>
              </div>

              <Button onClick={handleSubmit} className="w-full bg-blue-600 hover:bg-blue-700 h-12" size="lg">
                Continue to Consent & Signature
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Image Viewer */}
      {viewingImage && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4" onClick={() => setViewingImage(null)}>
          <button className="absolute top-4 right-4 text-white"><X className="h-8 w-8" /></button>
          <img src={viewingImage} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}


