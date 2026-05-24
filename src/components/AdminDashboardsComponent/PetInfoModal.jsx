import { useState, useEffect } from "react";
import { Badge } from '../../ui/badge';
import { toast } from "../../reusecomponent/toast.jsx";

export default function PetInfoModal({ petId, petName }) {
    const [pet, setPet] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPetData = async () => {
            if (!petId) {
                setIsLoading(false);
                return;
            }
            try {
                const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/pet_information/${petId}`);
                if (response.ok) {
                    const data = await response.json();
                    setPet(data);
                } else {
                    toast.error("Failed to load pet details");
                }
            } catch (error) {
                console.error("Error fetching pet data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPetData();
    }, [petId]);

    if (isLoading) {
        return <div className="p-4 text-center text-gray-500 sm:p-8">Loading pet information...</div>;
    }

    if (!pet) {
        return (
            <div className="space-y-4 p-4 text-center sm:p-8">
                <div className="text-gray-500 italic">No detailed records found for this pet.</div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                    This pet might be unregistered or its detailed information is missing from our records.
                    Pet Name: {petName}
                </div>
            </div>
        );
    }

    return (
        <div className="max-h-[70vh] overflow-y-auto space-y-6 pr-2">
            {/* Pet Card */}
            <div className="rounded-[14px] border border-[rgba(0,0,0,0.1)] bg-white p-4 text-center sm:p-6">
                {/* Pet Image */}
                <div className="flex justify-center mb-4">
                    <div className="relative size-[150px] rounded-full overflow-hidden border-4 border-[#155dfc] bg-gray-100 flex items-center justify-center">
                        {pet.profileImage ? (
                            <img
                                alt={pet.name}
                                className="absolute inset-0 size-full object-cover"
                                src={pet.profileImage}
                            />
                        ) : (
                            <span className="text-4xl">🐾</span>
                        )}
                    </div>
                </div>

                {/* Pet Name */}
                <h3 className="font-['Arimo:Bold',sans-serif] text-[24px] text-[#101828] mb-2">
                    {pet.name}
                </h3>

                {/* Species and Breed */}
                <p className="font-['Arimo:Regular',sans-serif] text-[16px] text-[#4a5565] mb-1">
                    {pet.species} • {pet.breed}
                </p>

                {/* Age and Gender */}
                <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565] mb-3">
                    {pet.age || 'Age Unknown'} • {pet.gender}
                </p>

                {/* Health Status Badge */}
                <Badge className={`${
                    pet.status === 'Healthy' ? 'bg-[#e0f2e9] text-[#0c6a3c]' : 
                    pet.status === 'Emergency' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'
                } hover:opacity-80`}>
                    {pet.status}
                </Badge>
            </div>

            {/* Pet Details */}
            <div className="rounded-[14px] bg-[#f9fafb] p-4 sm:p-6">
                <h4 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-4">
                    Pet Details
                </h4>

                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Species:</span>
                        <span className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">{pet.species}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Breed:</span>
                        <span className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">{pet.breed}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Birthday:</span>
                        <span className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">{pet.birthDate || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Weight:</span>
                        <span className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">{pet.weight ? `${pet.weight} kg` : 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Color/Markings:</span>
                        <span className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">{pet.color || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Microchip ID:</span>
                        <span className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">{pet.microchipId || 'None'}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t pt-2">
                        <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">Owner:</span>
                        <span className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">{pet.ownerName || 'Unknown'}</span>
                    </div>
                </div>
            </div>

            {/* Medical Info */}
            {pet.allergies_raw && (
                <div className="bg-[#f9fafb] rounded-[14px] p-6">
                    <h4 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-4">
                        Medical Alerts
                    </h4>
                    <div className="bg-red-50 border border-red-100 rounded-[8px] p-3">
                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-red-700 mb-1">Allergies</p>
                        <p className="font-['Arimo:Regular',sans-serif] text-[14px] text-red-600">{pet.allergies_raw}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
