import { useEffect, useState } from "react";
import { useNavigate } from "./dashboardRouter";
import { Card, CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import { Plus, PawPrint } from "lucide-react";

export default function MyPets() {
  const navigate = useNavigate();
  const [pets, setPets] = useState([]);

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const user = users.find((u) => u.id === currentUser.id);
    
    if (user && user.pets) {
      setPets(user.pets);
    }
  }, []);

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
              Add your first pet to get started with managing their healthcare.
            </p>
            <Button onClick={() => navigate("/dashboard/my-pets/add")}>
              <Plus className="h-5 w-5 mr-2" />
              Add Your First Pet
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
                <h3 className="text-xl font-bold text-gray-700 mb-1">Add New Pet</h3>
                <p className="text-gray-500 text-sm">Register another pet</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

