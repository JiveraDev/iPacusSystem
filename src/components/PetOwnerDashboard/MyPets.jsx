import { useEffect, useState } from "react";
import { useNavigate } from "./dashboardRouter";
import { Card, CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import { Plus, PawPrint, Loader2 } from "lucide-react";
import { getUserPetsService } from "../../services/ConnectOwnership";
import { toast } from "../../reusecomponent/toast.jsx";
import { resolveImageUrl } from "../../lib/image";

export default function MyPets() {
  const navigate = useNavigate();
  const [pets, setPets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPets() {
      try {
        const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
        // Check for various ID keys (id, user_id, userId)
        const userId = currentUser.id || currentUser.user_id || currentUser.userId;

        if (!userId) {
          toast.error("User session not found. Please log in again.");
          setIsLoading(false);
          return;
        }

        const userPets = await getUserPetsService(userId);
        // userPets is now formatted correctly by the backend (mapping db_columns to frontend keys)
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
        <Loader2 className="h-12 w-12 text-[#155dfc] animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Loading your pets...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">My Pets</h1>
        {pets.length > 0 && (
          <Button 
            onClick={() => navigate("/dashboard/my-pets/add")}
            className="bg-[#155dfc] hover:bg-blue-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            Link Pet
          </Button>
        )}
      </div>

      {pets.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
          <CardContent className="pt-10 pb-10 text-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <PawPrint className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-2">No Pets Linked Yet</h3>
            <p className="text-slate-500 mb-8 max-w-sm mx-auto">
              Link your first pet using the unique Registration ID provided by your clinic (e.g., PET-X-IPAWCUS).
            </p>
            <Button 
              onClick={() => navigate("/dashboard/my-pets/add")}
              className="bg-[#155dfc] hover:bg-blue-700 px-8 h-12 text-base font-semibold"
            >
              <Plus className="h-5 w-5 mr-2" />
              Link Your First Pet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {pets.map((pet) => (
            <Card 
              key={pet.id || pet.db_id} 
              className="group cursor-pointer border-slate-200 hover:border-[#155dfc] hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden"
              onClick={() => navigate(`/dashboard/my-pets/${pet.id}`)}
            >
              <CardContent className="pt-8">
                <div className="text-center">
                  <div className="relative inline-block mb-6">
                    {pet.profileImage ? (
                        <img
                            src={resolveImageUrl(pet.profileImage)}
                            alt={pet.name}
                            className="w-32 h-32 rounded-full object-cover mx-auto border-4 border-white shadow-md group-hover:scale-105 transition-transform duration-300"
                        />
                    ) : (
                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#155dfc] to-blue-600 flex items-center justify-center mx-auto shadow-md">
                            <PawPrint className="h-14 w-14 text-white opacity-90" />
                        </div>
                    )}
                    
                    {pet.status && (
                        <span className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white ${
                            pet.status === 'Healthy' ? 'bg-green-500' : 
                            pet.status === 'Emergency' ? 'bg-red-500 animate-pulse' : 
                            'bg-amber-500'
                        }`} />
                    )}
                  </div>

                  <h3 className="text-xl font-extrabold text-slate-900 mb-1 group-hover:text-[#155dfc] transition-colors">
                    {pet.name}
                  </h3>
                  <p className="text-slate-500 font-medium mb-3">{pet.species} • {pet.breed}</p>
                  
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-400 font-medium mb-4">
                    <span>{pet.age || 'N/A'}</span>
                    <span className="text-slate-200">•</span>
                    <span>{pet.gender || 'N/A'}</span>
                  </div>

                  {pet.status && (
                    <div className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm bg-white border border-slate-100">
                      <span className={
                        pet.status === 'Healthy' ? 'text-green-600' : 
                        pet.status === 'Emergency' ? 'text-red-600' : 
                        'text-amber-600'
                      }>
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
            className="cursor-pointer border-dashed border-2 border-slate-200 bg-slate-50/30 hover:bg-blue-50/30 hover:border-[#155dfc] transition-all group flex flex-col justify-center min-h-[300px]"
            onClick={() => navigate("/dashboard/my-pets/add")}
          >
            <CardContent className="pt-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                  <Plus className="h-10 w-10 text-slate-300 group-hover:text-[#155dfc]" />
                </div>
                <h3 className="text-lg font-bold text-slate-700 group-hover:text-[#155dfc]">Link New Pet</h3>
                <p className="text-slate-400 text-sm mt-1">Register another clinic ID</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
