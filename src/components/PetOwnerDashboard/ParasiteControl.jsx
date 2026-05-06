import { useNavigate } from "./dashboardRouter";
import { toast } from "../../reusecomponent/toast.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Bug, ArrowLeft, Upload, X } from "lucide-react";
import { useState, useEffect } from "react";

export default function ParasiteControl() {
  const navigate = useNavigate();
  const [pets, setPets] = useState([]);
  const [isLoadingPets, setIsLoadingPets] = useState(true);
  const [isNewPet, setIsNewPet] = useState(false);
  const [formData, setFormData] = useState({
    petId: "",
    petName: "",
    newPetSpecies: "",
    newPetBreed: "",
    newPetAge: "",
    newPetWeight: "",
    date: "",
    time: "",
    notes: "",
    files: [],
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

        const url = `${import.meta.env.VITE_API_BASE_URL}/users/${userId}/pets`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setPets(data);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isNewPet && !formData.petId) {
      toast.error("Please select a pet");
      return;
    }

    if (isNewPet && !formData.petName) {
      toast.error("Please enter the pet's name");
      return;
    }

    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const userId = currentUser.id || currentUser.user_id;

      if (!userId) {
        toast.error("Please log in to book an appointment");
        return;
      }

      // 1. Upload all files if any
      let uploadedFileUrls = [];
      if (formData.files.length > 0) {
        toast.success("Uploading documents...");
        for (const file of formData.files) {
          const uploadFormData = new FormData();
          uploadFormData.append('image', file);
          uploadFormData.append('type', 'booking_concern');

          const uploadRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/upload`, {
            method: 'POST',
            body: uploadFormData
          });

          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            uploadedFileUrls.push(uploadData.url);
          }
        }
      }

      // 2. Prepare booking data
      const bookingPayload = {
        user_id: userId,
        pet_id: isNewPet ? 0 : formData.petId, 
        service_type: 'parasite-control',
        booking_date: formData.date,
        booking_time: formData.time,
        notes: formData.notes,
        Image_Booking_Concern_Path: uploadedFileUrls.join(','),
        registered_status: isNewPet ? 'Not Registered' : 'Registered',
        petType: isNewPet ? formData.newPetSpecies : (pets.find(p => p.db_id.toString() === formData.petId)?.species || ''),
        new_pet_name: formData.petName,
        new_pet_breed: formData.newPetBreed,
        new_pet_age: formData.newPetAge,
        new_pet_weight: formData.newPetWeight
      };

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookingPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to submit booking");
      }

      toast.success("Booking submitted! Awaiting admin approval.");
      navigate("/dashboard/services");
    } catch (error) {
      console.error("Booking error:", error);
      toast.error(error.message || "Failed to submit booking");
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFormData(prev => ({ 
        ...prev, 
        files: [...prev.files, ...newFiles] 
      }));
    }
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
      const selectedPet = pets.find(p => p.db_id.toString() === value);
      setFormData(prev => ({ 
        ...prev, 
        petId: value, 
        petName: selectedPet ? selectedPet.name : "" 
      }));
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/dashboard/services")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Parasite Control</h1>
          <p className="text-gray-600 mt-1">Prevention and treatment for parasites</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Booking Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
            <CardDescription>Fill in the information below to schedule your appointment</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="petSelect">Select Pet *</Label>
                <Select value={formData.petId} onValueChange={handlePetChange}>
                  <SelectTrigger id="petSelect">
                    <SelectValue 
                      placeholder={isLoadingPets ? "Loading pets..." : "Choose your pet"} 
                      displayValue={
                        formData.petId === "new-pet" 
                          ? "🐾 New Pet (Not Registered)" 
                          : pets.find(p => p.db_id.toString() === formData.petId)?.name
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {pets.map((pet) => (
                      <SelectItem key={pet.db_id} value={pet.db_id.toString()}>
                        {pet.name} ({pet.species} - {pet.breed})
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
                        required={isNewPet}
                        value={formData.newPetBreed}
                        onChange={(e) => setFormData({ ...formData, newPetBreed: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPetAge">Age *</Label>
                      <Input
                        id="newPetAge"
                        placeholder="e.g., 2 years"
                        required={isNewPet}
                        value={formData.newPetAge}
                        onChange={(e) => setFormData({ ...formData, newPetAge: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="newPetWeight">Weight (Optional)</Label>
                      <Input
                        id="newPetWeight"
                        placeholder="e.g., 25 kg"
                        value={formData.newPetWeight}
                        onChange={(e) => setFormData({ ...formData, newPetWeight: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Preferred Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Preferred Time *</Label>
                  <Input
                    id="time"
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Describe any symptoms or concerns"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="files">Upload Files (optional)</Label>
                <div className="flex flex-col gap-4">
                  <div className="relative">
                    <Input
                      id="files"
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Label
                      htmlFor="files"
                      className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
                    >
                      <Upload className="h-5 w-5 text-gray-400" />
                      <span className="text-sm text-gray-600">Click to upload or drag and drop</span>
                    </Label>
                  </div>
                  
                  {formData.files.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {formData.files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 border rounded-md group">
                          <span className="text-xs truncate max-w-[150px]">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full">
                Submit Booking Request
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Service Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bug className="h-8 w-8" />
              </div>
              <CardTitle className="text-center">Parasite Control</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <h4 className="font-semibold mb-2">What's Included:</h4>
                  <ul className="space-y-1 ml-4">
                    <li>• Flea and tick treatment</li>
                    <li>• Deworming medication</li>
                    <li>• Parasite screening</li>
                    <li>• Prevention plan</li>
                    <li>• Follow-up care guidance</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Duration:</h4>
                  <p>20-30 minutes</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Price:</h4>
                  <p className="text-lg font-bold text-orange-600">$40-$70</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <p className="text-sm text-gray-700">
                ℹ️ Your booking will be reviewed by our team. You'll receive a confirmation email once approved.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
