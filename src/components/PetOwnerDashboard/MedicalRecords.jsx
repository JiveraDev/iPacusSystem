import { useEffect, useState } from "react";
import { useNavigate, useParams } from "./dashboardRouter";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { Badge } from "../../ui/badge";
import { ArrowLeft, FileText, Calendar, Pill, Activity, Loader2 } from "lucide-react";
import { toast } from "../../reusecomponent/toast.jsx";

import { findPetService } from "../../services/findPet";

export default function MedicalRecords() {
  const navigate = useNavigate();
  const { petId } = useParams();
  const [pet, setPet] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPetRecords() {
      try {
        const data = await findPetService(petId);
        setPet(data);
      } catch (error) {
        console.error("Error fetching pet records:", error);
        toast.error("Could not load medical records");
      } finally {
        setIsLoading(false);
      }
    }

    if (petId) {
      fetchPetRecords();
    }
  }, [petId]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600">Loading medical records...</p>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="space-y-8">
        <Button variant="ghost" onClick={() => navigate("/dashboard/my-pets")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Pet Not Found</h3>
            <Button onClick={() => navigate("/dashboard/my-pets")}>
              Back to My Pets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get organized and unorganized records (placeholders for now as backend might not have them yet)
  const organizedRecords = pet.medicalRecords?.organized || [];
  const unorganizedRecords = pet.medicalRecords?.unorganized || [];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(`/dashboard/my-pets/${petId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {pet.name}'s Profile
        </Button>
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Electronic Medical Records</h1>
        <p className="text-gray-600">{pet.name} - {pet.species} • {pet.breed}</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="organized" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="organized">Organized Records</TabsTrigger>
          <TabsTrigger value="unorganized">Service History</TabsTrigger>
        </TabsList>

        {/* Organized Records Tab */}
        <TabsContent value="organized" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                Diagnosis & Treatment Groups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Records grouped by diagnosis and follow-up visits, showing complete treatment history.
              </p>
            </CardContent>
          </Card>

          {organizedRecords.length > 0 ? (
            <div className="space-y-6">
              {/* ... (render records) */}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No Organized Records</h3>
                <p className="text-gray-600">
                  No grouped diagnosis records available yet for {pet.name}.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Service History Tab */}
        <TabsContent value="unorganized" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                All Service History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Complete history of all services and visits, sorted by date.
              </p>
            </CardContent>
          </Card>

          {unorganizedRecords.length > 0 ? (
            <div className="space-y-4">
              {/* ... (render service history) */}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No Service History</h3>
                <p className="text-gray-600">
                  No service records available yet for {pet.name}.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
