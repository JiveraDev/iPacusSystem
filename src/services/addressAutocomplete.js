const API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

export async function searchAddresses(query, signal) {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 3) {
        return [];
    }

    if (!API_KEY) {
        throw new Error("Missing VITE_GEOAPIFY_API_KEY for address autocomplete.");
    }

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
        id: item.place_id ?? `${item.lat}-${item.lon}-${index}`,
        label: item.formatted ?? item.address_line1 ?? item.city ?? trimmedQuery,
        fullAddress: item.formatted ?? item.address_line1 ?? trimmedQuery,
        street: item.street ?? "",
        houseNumber: item.housenumber ?? "",
        postcode: item.postcode ?? "",
    }));
}
