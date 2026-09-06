export const DEFAULT_STORAGE_AREA = 'General Storage';

function cleanText(value) {
    return String(value ?? '').trim();
}

export function matchingLocation(locations, locationName, storageArea) {
    const normalizedName = cleanText(locationName).toLowerCase();
    const normalizedArea = cleanText(storageArea || DEFAULT_STORAGE_AREA).toLowerCase();

    return locations.find((location) => (
        cleanText(location.name).toLowerCase() === normalizedName
        && cleanText(location.storageArea || DEFAULT_STORAGE_AREA).toLowerCase() === normalizedArea
    ));
}
