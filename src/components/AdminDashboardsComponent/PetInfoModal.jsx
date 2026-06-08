import { useEffect, useState } from 'react';
import { AlertCircle, Calendar, Check, PawPrint, User } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { calculateAge, formatDisplayDate } from '../../lib/date';
import { resolveImageUrl } from '../../lib/image';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

function normalizePet(data = {}) {
    const isRegistered = data.isRegistered ?? Boolean(data.db_id || data.petId || data.petShareableId || data.id);

    return {
        id: data.id || data.petShareableId || '',
        dbId: data.db_id || data.petId || '',
        name: data.name || data.petName || '',
        species: data.species || data.petSpecies || '',
        breed: data.breed || data.petBreed || '',
        birthDate: data.birthDate || data.petBirthDate || '',
        gender: data.gender || data.petGender || '',
        status: data.status || data.petStatus || (isRegistered ? 'Registered' : 'Not Registered'),
        age: data.age || data.petAge || '',
        weight: data.weight || data.petWeight || '',
        color: data.color || data.petColor || '',
        microchipId: data.microchipId || data.petMicrochipId || '',
        ownerName: data.ownerName || data.petTempOwner || '',
        profileImage: data.profileImage || data.petProfileImage || '',
        allergiesRaw: data.allergies_raw || data.petAllergies || '',
        allergies: Array.isArray(data.allergies) ? data.allergies : [],
        isRegistered
    };
}

function getBookingFallbackPets(booking, petName) {
    if (!booking) {
        return petName ? [normalizePet({ petName, isRegistered: false })] : [];
    }

    return [normalizePet({
        ...booking,
        petName: booking.petName || petName,
        isRegistered: booking.isRegistered
    })];
}

export default function PetInfoModal({ petId, petName, booking }) {
    const [pets, setPets] = useState(() => getBookingFallbackPets(booking, petName));
    const [isLoading, setIsLoading] = useState(Boolean(petId || booking?.petIds?.length));

    useEffect(() => {
        let isMounted = true;

        const fetchPets = async () => {
            const ids = Array.isArray(booking?.petIds) && booking.petIds.length > 0
                ? booking.petIds
                : petId
                    ? [petId]
                    : [];

            if (ids.length === 0 || booking?.isRegistered === false) {
                setPets(getBookingFallbackPets(booking, petName));
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const fetchedPets = await Promise.all(ids.map(async (id) => {
                    const response = await fetch(`${API_BASE}/api/pet_information/${id}`);
                    if (!response.ok) {
                        return null;
                    }
                    return response.json();
                }));
                const normalizedPets = fetchedPets.filter(Boolean).map(normalizePet);

                if (isMounted) {
                    setPets(normalizedPets.length > 0 ? normalizedPets : getBookingFallbackPets(booking, petName));
                }
            } catch (error) {
                console.error('Error fetching pet data:', error);
                if (isMounted) {
                    setPets(getBookingFallbackPets(booking, petName));
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchPets();

        return () => {
            isMounted = false;
        };
    }, [petId, petName, booking]);

    if (isLoading) {
        return <div className="p-6 text-center text-slate-500">Loading pet information...</div>;
    }

    if (pets.length === 0) {
        return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
                No pet details were found for this booking.
            </div>
        );
    }

    return (
        <div className="max-h-[70vh] min-w-0 space-y-4 overflow-y-auto pr-0 sm:space-y-6 sm:pr-2">
            {pets.map((pet, index) => (
                <PetDetails key={pet.dbId || pet.id || `${pet.name}-${index}`} pet={pet} />
            ))}
        </div>
    );
}

function PetDetails({ pet }) {
    const [imageError, setImageError] = useState(false);
    const imageUrl = imageError ? null : resolveImageUrl(pet.profileImage);
    const displayAge = pet.birthDate ? calculateAge(pet.birthDate) : pet.age;
    const allergies = pet.allergies.length > 0
        ? pet.allergies
        : pet.allergiesRaw
            ? [{ allergen: pet.allergiesRaw, severity: 'Known' }]
            : [];

    return (
        <div className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-3 sm:space-y-6 sm:p-5">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                <div className="relative">
                    <div className="size-24 overflow-hidden rounded-2xl border-4 border-white bg-slate-100 shadow-xl ring-1 ring-slate-100 sm:size-28 sm:rounded-3xl">
                        {imageUrl ? (
                            <img
                                src={imageUrl}
                                alt={pet.name || 'Pet'}
                                className="size-full object-cover"
                                onError={() => setImageError(true)}
                            />
                        ) : (
                            <div className="flex size-full items-center justify-center bg-blue-50">
                                <PawPrint className="size-14 text-[#155dfc]" />
                            </div>
                        )}
                    </div>
                    <Badge className={`absolute -left-2 -top-2 border-2 border-white ${
                        pet.isRegistered
                            ? 'bg-green-50 text-green-700'
                            : 'bg-amber-50 text-amber-700'
                    }`}>
                        {pet.isRegistered ? 'Registered' : 'Not Registered'}
                    </Badge>
                </div>

                <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Pet Profile</p>
                    <h3 className="mt-1 break-words text-xl font-black text-slate-900 sm:text-2xl">{pet.name || 'Unnamed Pet'}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                        {[pet.species, pet.breed].filter(Boolean).join(' - ') || 'Species not set'}
                    </p>
                    {pet.id && (
                        <code className="mt-3 inline-block max-w-full truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-[#155dfc]">
                            {pet.id}
                        </code>
                    )}
                </div>
            </div>

            <section className="rounded-2xl bg-slate-50 p-3 sm:p-5">
                <h4 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                    Biological Profile
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <BioField label="Species" value={pet.species} />
                    <BioField label="Primary Breed" value={pet.breed} />
                    <BioField icon={Calendar} label="Birth Date" value={pet.birthDate ? formatDisplayDate(pet.birthDate) : ''} />
                    <BioField label="Estimated Age" value={displayAge} />
                    <BioField label="Sex / Gender" value={pet.gender} />
                    <BioField label="Body Weight" value={pet.weight ? `${pet.weight} kg` : ''} />
                    <BioField label="Coloration" value={pet.color} />
                    <BioField label="Health Status" value={pet.status} />
                    <BioField icon={Check} label="Microchip ID" value={pet.microchipId} />
                    <BioField icon={User} label="Owner Name" value={pet.ownerName} />
                </div>
            </section>

            <section className={`rounded-2xl p-3 sm:p-5 ${allergies.length > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                <div className="mb-3 flex items-center gap-2">
                    <AlertCircle className="size-5 text-[#991b1b] dark:text-[#ef4444]" />
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-[#991b1b] dark:text-[#ef4444]">Critical Allergies</h4>
                </div>
                {allergies.length > 0 ? (
                    <div className="space-y-2">
                        {allergies.map((allergy, index) => (
                            <div key={`${allergy.allergen}-${index}`} className="rounded-xl border border-red-100 bg-white p-3">
                                <p className="text-sm font-black uppercase text-red-600">{allergy.allergen}</p>
                                <p className="mt-1 text-xs font-semibold text-red-400">{allergy.severity || 'Known'} reaction type</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm font-medium text-slate-400">No known clinical allergies recorded.</p>
                )}
            </section>
        </div>
    );
}

function BioField({ label, value, icon: Icon }) {
    return (
        <div className="space-y-1.5">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                {Icon && <Icon className="size-4 text-slate-400" />}
                {label}
            </p>
            <div className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:px-4">
                <p className="break-words text-sm font-semibold text-slate-900 sm:text-base">
                    {value || 'Not set'}
                </p>
            </div>
        </div>
    );
}
