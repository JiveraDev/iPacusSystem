export const DECEASED_PET_BOOKING_MESSAGE = "This pet is marked as deceased and cannot be booked.";

export function isDeceasedPetStatus(status) {
    const normalized = String(status || "").trim().toLowerCase();
    return normalized === "deceased" || normalized === "dead";
}

export function getPetStatus(pet) {
    return pet?.status ?? pet?.petStatus ?? pet?.pet_status ?? "";
}

export function isPetDeceased(pet) {
    return isDeceasedPetStatus(getPetStatus(pet));
}

export function getPetSelectLabel(pet) {
    const name = pet?.name || pet?.petName || pet?.pet_name || "Unnamed Pet";
    const species = pet?.species || pet?.pet_species || "";
    const breed = pet?.breed || pet?.pet_breed || "";
    const details = [species, breed].filter(Boolean).join(" - ");
    const suffix = isPetDeceased(pet) ? " - Deceased" : "";

    return details ? `${name} (${details})${suffix}` : `${name}${suffix}`;
}
