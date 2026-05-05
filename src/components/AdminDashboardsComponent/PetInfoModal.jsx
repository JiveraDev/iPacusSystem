import { Badge } from '../../ui/badge';

export default function PetInfoModal({ petName }) {
    // Get pet data based on name
    const getPetData = () => {
        switch (petName.toLowerCase()) {
            case 'max':
                return {
                    image: imgImageMax,
                    name: 'Max',
                    species: 'Dog',
                    breed: 'Golden Retriever',
                    age: '5 years',
                    gender: 'Male',
                    healthStatus: 'Healthy'
                };
            case 'luna':
                return {
                    image: imgImageLuna,
                    name: 'Luna',
                    species: 'Cat',
                    breed: 'Persian',
                    age: '3 years',
                    gender: 'Female',
                    healthStatus: 'Healthy'
                };
            case 'charlie':
                return {
                    image: imgImageCharlie,
                    name: 'Charlie',
                    species: 'Dog',
                    breed: 'Labrador Retriever',
                    age: '2 years',
                    gender: 'Male',
                    healthStatus: 'Healthy'
                };
            default:
                return {
                    image: imgImageMax,
                    name: petName,
                    species: 'Dog',
                    breed: 'Mixed Breed',
                    age: '3 years',
                    gender: 'Male',
                    healthStatus: 'Healthy'
                };
        }
    };

    const pet = getPetData();

    return (
        <div className="max-h-[70vh] overflow-y-auto space-y-6 pr-2">
            {/* Pet Card */}
            <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[14px] p-6 text-center">
                {/* Pet Image */}
                <div className="flex justify-center mb-4">
                    <div className="relative size-[150px] rounded-full overflow-hidden border-4 border-[#155dfc]">
                        <img
                            alt={pet.name}
                            className="absolute inset-0 size-full object-cover"
                            src={pet.image}
                        />
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
                    {pet.age} • {pet.gender}
                </p>

                {/* Health Status Badge */}
                <Badge className="bg-[#e0f2e9] text-[#0c6a3c] hover:bg-[#e0f2e9]">
                    {pet.healthStatus}
                </Badge>
            </div>

            {/* Pet Details */}
            <div className="bg-[#f9fafb] rounded-[14px] p-6">
                <h4 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-4">
                    Pet Details
                </h4>

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
            <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
              Species:
            </span>
                        <span className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">
              {pet.species}
            </span>
                    </div>

                    <div className="flex justify-between items-center">
            <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
              Breed:
            </span>
                        <span className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">
              {pet.breed}
            </span>
                    </div>

                    <div className="flex justify-between items-center">
            <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
              Age:
            </span>
                        <span className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">
              {pet.age}
            </span>
                    </div>

                    <div className="flex justify-between items-center">
            <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
              Gender:
            </span>
                        <span className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">
              {pet.gender}
            </span>
                    </div>

                    <div className="flex justify-between items-center">
            <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
              Weight:
            </span>
                        <span className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">
              25 kg
            </span>
                    </div>

                    <div className="flex justify-between items-center">
            <span className="font-['Arimo:Regular',sans-serif] text-[14px] text-[#4a5565]">
              Microchip ID:
            </span>
                        <span className="font-['Arimo:Bold',sans-serif] text-[16px] text-[#101828]">
              985112345678901
            </span>
                    </div>
                </div>
            </div>

            {/* Medical History */}
            <div className="bg-[#f9fafb] rounded-[14px] p-6">
                <h4 className="font-['Arimo:Bold',sans-serif] text-[18px] text-[#101828] mb-4">
                    Recent Medical History
                </h4>

                <div className="space-y-3">
                    <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[8px] p-3">
                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">
                            Vaccination - Rabies
                        </p>
                        <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                            January 20, 2026
                        </p>
                    </div>

                    <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[8px] p-3">
                        <p className="font-['Arimo:Bold',sans-serif] text-[14px] text-[#101828] mb-1">
                            General Check-up
                        </p>
                        <p className="font-['Arimo:Regular',sans-serif] text-[12px] text-[#4a5565]">
                            December 15, 2025
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}