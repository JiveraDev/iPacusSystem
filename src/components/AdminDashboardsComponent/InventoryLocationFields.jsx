import { useMemo } from 'react';
import { MapPin, Warehouse } from 'lucide-react';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { DEFAULT_STORAGE_AREA, matchingLocation } from './inventoryLocationUtils.js';

function cleanText(value) {
    return String(value ?? '').trim();
}

function uniqueText(values) {
    const seen = new Set();

    return values
        .map(cleanText)
        .filter(Boolean)
        .filter((value) => {
            const key = value.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((left, right) => left.localeCompare(right));
}

export default function InventoryLocationFields({
    locations = [],
    locationName,
    storageArea,
    onChange,
    disabled = false,
    idPrefix = 'inventory-location',
    compact = false,
}) {
    const locationOptions = useMemo(
        () => uniqueText(locations.map((location) => location.name)),
        [locations],
    );
    const storageOptions = useMemo(() => {
        const matchingAreas = locations
            .filter((location) => cleanText(location.name).toLowerCase() === cleanText(locationName).toLowerCase())
            .map((location) => location.storageArea || DEFAULT_STORAGE_AREA);

        return uniqueText([
            ...matchingAreas,
            ...locations.map((location) => location.storageArea || DEFAULT_STORAGE_AREA),
            DEFAULT_STORAGE_AREA,
        ]);
    }, [locationName, locations]);

    const emitChange = (nextName, nextArea) => {
        const cleanName = cleanText(nextName);
        const cleanArea = cleanText(nextArea) || DEFAULT_STORAGE_AREA;
        const savedLocation = matchingLocation(locations, cleanName, cleanArea);

        onChange?.({
            locationId: savedLocation ? String(savedLocation.id) : '',
            locationName: cleanName,
            storageArea: cleanArea,
            isNew: Boolean(cleanName) && !savedLocation,
        });
    };

    const handleLocationChange = (nextName) => {
        const savedForName = locations.filter(
            (location) => cleanText(location.name).toLowerCase() === cleanText(nextName).toLowerCase(),
        );
        const currentAreaStillMatches = savedForName.some(
            (location) => cleanText(location.storageArea || DEFAULT_STORAGE_AREA).toLowerCase() === cleanText(storageArea).toLowerCase(),
        );
        const nextArea = currentAreaStillMatches
            ? storageArea
            : (savedForName[0]?.storageArea || DEFAULT_STORAGE_AREA);

        emitChange(nextName, nextArea);
    };

    const helperText = locationName && !matchingLocation(locations, locationName, storageArea)
        ? 'This new location will be saved to suggestions after you confirm.'
        : 'Search saved options or type a new location and storage area.';

    return (
        <div className={compact ? 'space-y-3' : 'space-y-4'}>
            <div className={compact ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-4 md:grid-cols-2'}>
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-name`}>Inventory location *</Label>
                    <Select
                        value={locationName}
                        onValueChange={handleLocationChange}
                        searchPlaceholder="Search or type a location"
                        emptyMessage="No saved location found."
                        allowCustom
                        customOptionLabel={(value) => `Use new location “${value}”`}
                        onCreateOption={handleLocationChange}
                        disabled={disabled}
                    >
                        <SelectTrigger id={`${idPrefix}-name`}>
                            <MapPin className="size-4 text-slate-400" />
                            <SelectValue placeholder="Choose or add location" displayValue={locationName} />
                        </SelectTrigger>
                        <SelectContent>
                            {locationOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-storage`}>Storage area *</Label>
                    <Select
                        value={storageArea}
                        onValueChange={(value) => emitChange(locationName, value)}
                        searchPlaceholder="Search or type a storage area"
                        emptyMessage="No saved storage area found."
                        allowCustom
                        customOptionLabel={(value) => `Use new storage area “${value}”`}
                        onCreateOption={(value) => emitChange(locationName, value)}
                        disabled={disabled || !locationName}
                    >
                        <SelectTrigger id={`${idPrefix}-storage`}>
                            <Warehouse className="size-4 text-slate-400" />
                            <SelectValue placeholder="Choose or add storage area" displayValue={storageArea} />
                        </SelectTrigger>
                        <SelectContent>
                            {storageOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{helperText}</p>
        </div>
    );
}
