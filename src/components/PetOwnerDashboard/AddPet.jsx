import { useState } from "react";
import { useNavigate } from "./dashboardRouter";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { toast } from "./toast";
import { ArrowLeft, PawPrint, AlertCircle } from "lucide-react";

export default function AddPet() {
  const navigate = useNavigate();
  const [petId, setPetId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!petId.trim()) {
      toast.error("Please enter a Pet ID");
      return;
    }

    setIsLoading(true);

    // Simulate API call to verify pet ID exists in clinic system
    setTimeout(() => {
      // TODO: Replace with actual API call to verify pet ID
      // For now, we'll just accept any pet ID and link it to the user
      
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      const userIndex = users.findIndex((u) => u.id === currentUser.id);

      if (userIndex !== -1) {
        // Check if pet ID already linked to this user
        const existingPet = users[userIndex].pets?.find((p) => p.registrationId === petId.trim());
        
        if (existingPet) {
          toast.error("This pet is already linked to your account");
          setIsLoading(false);
          return;
        }

        // Create a placeholder pet record that will be populated by the clinic
        const linkedPet = {
          id: Date.now().toString(),
          registrationId: petId.trim(),
          name: "Pending Clinic Registration",
          species: "",
          breed: "",
          age: "",
          gender: "",
          weight: "",
          color: "",
          dateOfBirth: "",
          microchipId: "",
          status: "Pending",
          profileImage: "",
          vaccinations: [],
          allergies: [],
          medicalRecords: {
            organized: [],
            unorganized: []
          },
          createdAt: new Date().toISOString(),
        };

        if (!users[userIndex].pets) {
          users[userIndex].pets = [];
        }
        users[userIndex].pets.push(linkedPet);
        localStorage.setItem("users", JSON.stringify(users));
        localStorage.setItem("currentUser", JSON.stringify(users[userIndex]));

        toast.success("Pet ID linked successfully! The clinic will complete the registration.");
        navigate("/dashboard/my-pets");
      }
      
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate("/dashboard/my-pets")} className="self-start">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Link Your Pet</h1>
        </div>
      </div>

      <Card className="border-2 border-blue-100">
        <CardHeader className="bg-blue-50">
          <CardTitle className="flex items-center gap-2">
            <PawPrint className="h-5 w-5 text-blue-600" />
            Enter Pet Registration ID
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">How to link your pet:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Visit our clinic or have your pet registered by our staff</li>
                <li>Receive a unique Pet Registration ID from the veterinarian</li>
                <li>Enter the ID below to link your pet to your account</li>
                <li>The clinic will complete your pet's profile with medical information</li>
              </ol>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="petId" className="text-base font-semibold">
                Pet Registration ID *
              </Label>
              <Input
                id="petId"
                placeholder="Enter the ID provided by the clinic (e.g., PET-2024-001234)"
                value={petId}
                onChange={(e) => setPetId(e.target.value)}
                className="text-lg h-12"
                required
                disabled={isLoading}
              />
              <p className="text-sm text-gray-600">
                This ID was provided to you when your pet was registered at our clinic
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-gray-900">What happens next?</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>✓ Your pet will be linked to your account immediately</li>
                <li>✓ You can view and track your pet's medical records</li>
                <li>✓ Book consultations and services for your pet</li>
                <li>✓ Receive notifications about appointments and medications</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/dashboard/my-pets")} 
                className="flex-1"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? "Linking Pet..." : "Link Pet"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border border-gray-200">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-gray-900 mb-3">Need Help?</h3>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              <strong>Don't have a Pet Registration ID?</strong><br />
              Visit our clinic or schedule a consultation. Our staff will register your pet and provide you with a unique ID.
            </p>
            <p className="pt-2">
              <strong>Contact Us:</strong><br />
              Phone: (042) 373-5678<br />
              Email: support@vetfocuscare.com
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

