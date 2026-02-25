/**
 * Geocoding via Nominatim (OpenStreetMap) - free, no API key.
 * Rate limit: 1 request per second. Use for address search.
 * Uses Vancouver viewbox and Canada country code so addresses like "2125 West 45th Avenue" resolve.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'SafeMaps Vancouver/1.0';

// Vancouver area (min lon, min lat, max lon, max lat) - keeps results local
const VANCOUVER_VIEWBOX = '-123.31,49.20,-122.90,49.31';

let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1100;

async function waitForRateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_INTERVAL_MS) {
        await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
    }
    lastRequestTime = Date.now();
}

function normalizeAddressQuery(trimmed) {
    // Ensure Vancouver, BC is in the query so Nominatim finds local results
    const lower = trimmed.toLowerCase();
    if (lower.includes('vancouver') && (lower.includes('bc') || lower.includes('british columbia') || lower.includes('canada'))) {
        return trimmed;
    }
    if (lower.includes('vancouver')) {
        return `${trimmed}, BC Canada`;
    }
    return `${trimmed}, Vancouver BC Canada`;
}

export async function geocode(query) {
    if (!query || typeof query !== 'string') return [];
    const trimmed = query.trim();
    if (trimmed.length < 3) return [];

    await waitForRateLimit();

    const q = normalizeAddressQuery(trimmed);

    const params = new URLSearchParams({
        q,
        format: 'json',
        limit: '5',
        addressdetails: '1',
        countrycodes: 'ca',
        viewbox: VANCOUVER_VIEWBOX,
        bounded: '0', // 0 = prefer viewbox but allow outside if no match inside
    });
    const url = `${NOMINATIM_URL}?${params}`;
    const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
        // Fallback: try without street number (e.g. "West 45th Avenue" for "2125 West 45th Avenue")
        const withoutNumber = trimmed.replace(/^\d+\s+/, '').trim();
        if (withoutNumber.length >= 3 && withoutNumber !== trimmed) {
            await waitForRateLimit();
            const fallbackQ = normalizeAddressQuery(withoutNumber);
            const fallbackParams = new URLSearchParams({
                q: fallbackQ,
                format: 'json',
                limit: '5',
                addressdetails: '1',
                countrycodes: 'ca',
                viewbox: VANCOUVER_VIEWBOX,
                bounded: '0',
            });
            const fallbackRes = await fetch(`${NOMINATIM_URL}?${fallbackParams}`, {
                headers: { 'User-Agent': USER_AGENT },
            });
            if (fallbackRes.ok) {
                const fallbackData = await fallbackRes.json();
                if (Array.isArray(fallbackData) && fallbackData.length > 0) {
                    return fallbackData.slice(0, 5).map((item) => ({
                        lat: parseFloat(item.lat),
                        lng: parseFloat(item.lon),
                        displayName: item.display_name,
                    }));
                }
            }
        }
        return [];
    }
    return data.map((item) => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        displayName: item.display_name,
    }));
}
