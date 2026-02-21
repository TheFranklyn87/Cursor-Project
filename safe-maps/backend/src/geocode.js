/**
 * Geocoding via Nominatim (OpenStreetMap) - free, no API key.
 * Rate limit: 1 request per second. Use for address search.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'SafeMaps Vancouver/1.0';

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

export async function geocode(query) {
    if (!query || typeof query !== 'string') return null;
    const trimmed = query.trim();
    if (trimmed.length < 3) return null;

    await waitForRateLimit();

    let q = trimmed;
    if (!trimmed.toLowerCase().includes('vancouver')) {
        q += ', Vancouver BC Canada';
    }

    const params = new URLSearchParams({
        q,
        format: 'json',
        limit: '1',
        addressdetails: '1',
    });
    const url = `${NOMINATIM_URL}?${params}`;
    const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const item = data[0];
    return {
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        displayName: item.display_name,
    };
}
