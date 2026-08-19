import { useMemo, useState } from 'react';
import { ImageOff, MapPin } from 'lucide-react';
import { getAddressMapPreviewUrls } from '../../services/addressAutocomplete.js';

export default function AddressMapPreview({ location }) {
    const [failedMapUrls, setFailedMapUrls] = useState(() => new Set());
    const mapUrls = useMemo(() => getAddressMapPreviewUrls(location), [location]);
    const mapUrl = mapUrls.find((url) => !failedMapUrls.has(url)) || '';
    const didImageFail = mapUrls.length > 0 && !mapUrl;

    if (mapUrls.length === 0) {
        return null;
    }

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="relative h-44 bg-gray-100 sm:h-52">
                {didImageFail ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-gray-500">
                        <ImageOff className="h-6 w-6" />
                        <p className="text-sm font-medium">Map preview could not load.</p>
                        <p className="text-xs">The selected address is still available and editable.</p>
                    </div>
                ) : (
                    <img
                        src={mapUrl}
                        alt={`Map preview for ${location?.label || 'the selected address'}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={() => setFailedMapUrls((current) => new Set(current).add(mapUrl))}
                    />
                )}
            </div>
            <div className="flex items-start gap-2 border-t border-gray-100 px-3 py-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-700">Selected location preview</p>
                    <p className="truncate text-xs text-gray-500">{location?.label}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">Map data © Geoapify and OpenStreetMap contributors</p>
                </div>
            </div>
        </div>
    );
}
