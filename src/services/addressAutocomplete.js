const API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

function requireApiKey(feature) {
    if (!API_KEY) {
        throw new Error(`Current location ${feature} is not configured.`);
    }
}

function normalizeAddressResult(item, fallbackAddress = '') {
    const fullAddress = item?.formatted
        ?? item?.address_line1
        ?? item?.city
        ?? fallbackAddress;
    const latitude = Number(item?.lat);
    const longitude = Number(item?.lon);

    return {
        id: item?.place_id ?? `${item?.lat ?? 'address'}-${item?.lon ?? 'result'}`,
        label: fullAddress,
        fullAddress,
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        street: item?.street ?? '',
        houseNumber: item?.housenumber ?? '',
        postcode: item?.postcode ?? '',
    };
}

export async function searchAddresses(query, signal) {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 3) {
        return [];
    }

    requireApiKey('address search');

    const params = new URLSearchParams({
        text: trimmedQuery,
        apiKey: API_KEY,
        limit: "5",
        lang: "en",
        filter: "countrycode:ph",
        format: "json",
    });

    const response = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`,
        { signal }
    );

    if (!response.ok) {
        throw new Error(`Geoapify request failed: ${response.status}`);
    }

    const data = await response.json();

    return (data.results ?? []).map((item, index) => ({
        ...normalizeAddressResult(item, trimmedQuery),
        id: item.place_id ?? `${item.lat}-${item.lon}-${index}`,
    }));
}

export async function reverseGeocodeAddress(latitude, longitude, signal) {
    const normalizedLatitude = Number(latitude);
    const normalizedLongitude = Number(longitude);

    if (
        !Number.isFinite(normalizedLatitude)
        || !Number.isFinite(normalizedLongitude)
        || normalizedLatitude < -90
        || normalizedLatitude > 90
        || normalizedLongitude < -180
        || normalizedLongitude > 180
    ) {
        throw new Error('The browser returned an invalid location. Please enter the address manually.');
    }

    requireApiKey('lookup');

    const params = new URLSearchParams({
        lat: String(normalizedLatitude),
        lon: String(normalizedLongitude),
        apiKey: API_KEY,
        limit: '1',
        lang: 'en',
        format: 'json',
    });

    const response = await fetch(
        `https://api.geoapify.com/v1/geocode/reverse?${params.toString()}`,
        { signal }
    );

    if (!response.ok) {
        throw new Error(`Current location lookup failed (${response.status}). Please enter the address manually.`);
    }

    const data = await response.json();
    const result = data.results?.[0];

    if (!result) {
        throw new Error('No readable address was found for this location. Please enter the address manually.');
    }

    const countryCode = String(result.country_code ?? '').toLowerCase();
    if (countryCode && countryCode !== 'ph') {
        throw new Error('The selected location must be in the Philippines. You can still enter an address manually.');
    }

    return normalizeAddressResult(result);
}

export function getAddressMapPreviewUrls(location) {
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);

    if (!API_KEY || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return [];
    }

    const primaryParams = new URLSearchParams({
        style: 'osm-bright',
        width: '900',
        height: '360',
        center: `lonlat:${longitude},${latitude}`,
        zoom: '16',
        marker: `lonlat:${longitude},${latitude};type:material;color:#155dfc;size:medium`,
        scaleFactor: '2',
        apiKey: API_KEY,
    });
    const fallbackParams = new URLSearchParams({
        style: 'osm-bright',
        width: '900',
        height: '360',
        center: `lonlat:${longitude},${latitude}`,
        zoom: '16',
        apiKey: API_KEY,
    });

    return [primaryParams, fallbackParams]
        .map((params) => `https://maps.geoapify.com/v1/staticmap?${params.toString()}`);
}

export function getAddressMapPreviewUrl(location) {
    return getAddressMapPreviewUrls(location)[0] || '';
}
