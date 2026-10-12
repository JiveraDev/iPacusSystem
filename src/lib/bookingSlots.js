export function bookingSlotStatusLabel(slot, sharedMedical = false) {
    if (slot.available) {
        if (!sharedMedical) return 'Available';
        const count = Number(slot.availableCount) || 0;
        return `${count} ${count === 1 ? 'appointment' : 'appointments'} available`;
    }
    if (slot.status === 'lunch') return 'Lunch period';
    if (slot.status === 'booked') return sharedMedical ? 'Full' : 'Booked';
    return sharedMedical && Number(slot.capacity) === 0 ? 'No available vet' : 'Unavailable';
}
