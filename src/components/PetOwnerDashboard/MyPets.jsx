import { useEffect, useState } from "react";
import { useNavigate } from "./dashboardRouter";
import { Card, CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import { Plus, PawPrint, Loader2 } from "lucide-react";
import { getUserPetsService } from "../../services/ConnectOwnership";
import { toast } from "../../reusecomponent/toast.jsx";

export default function MyPets() {
  const navigate = useNavigate();
  const [pets, setPets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPets() {
      try {
        const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
        const userId = currentUser.id;

        if (!userId) {
          toast.error("User session not found");
          setIsLoading(false);
          return;
        }

        const userPets = await getUserPetsService(userId);
        setPets(userPets);
      } catch (error) {
        console.error("Failed to fetch pets:", error);
        toast.error("Failed to load your pets");
      } finally {
        setIsLoading(false);
      }
    }

    fetchPets();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-600">Loading your pets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Pets</h1>
      </div>

      {pets.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <PawPrint className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No Pets Yet</h3>
            <p className="text-gray-600 mb-4">
              Link your first pet using the Registration ID provided by the clinic.
            </p>
            <Button onClick={() => navigate("/dashboard/my-pets/add")}>
              <Plus className="h-5 w-5 mr-2" />
              Link Your First Pet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {pets.map((pet) => (
            <Card 
              key={pet.id} 
              className="cursor-pointer hover:shadow-lg transition-all hover:scale-105"
              onClick={() => navigate(`/dashboard/my-pets/${pet.id}`)}
            >
              <CardContent className="pt-6">
                <div className="text-center">
                  {pet.profileImage ? (
                    <img
                      src={pet.profileImage}
                      alt={pet.name}
                      className="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-blue-100"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center mx-auto mb-4">
                      <PawPrint className="h-16 w-16 text-white" />
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{pet.name}</h3>
                  <p className="text-gray-600 mb-2">{pet.species} • {pet.breed}</p>
                  <div className="flex justify-center gap-2 text-sm text-gray-600">
                    <span>{pet.age || 'N/A'} years old</span>
                    <span>•</span>
                    <span>{pet.gender || 'N/A'}</span>
                  </div>
                  {pet.status && (
                    <div className="mt-3">
                      <span className={`inline-block px-3 py-1 text-xs rounded-full ${
                        pet.status === 'Healthy' 
                          ? 'bg-green-100 text-green-700' 
                          : pet.status === 'Under Treatment'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {pet.status}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Add Pet Card */}
          <Card 
            className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-dashed border-2"
            onClick={() => navigate("/dashboard/my-pets/add")}
          >
            <CardContent className="pt-6 flex items-center justify-center h-full min-h-[280px]">
              <div className="text-center">
                <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Plus className="h-16 w-16 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-700 mb-1">Link New Pet</h3>
                <p className="text-gray-500 text-sm">Register another pet</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
