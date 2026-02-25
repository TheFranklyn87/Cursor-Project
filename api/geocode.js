/**
 * Vercel Serverless Function: GET /api/geocode
 * Consolidated from backend/src/geocode.js
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'SafeMaps Vancouver/1.0';
const VANCOUVER_VIEWBOX = '-123.31,49.20,-122.90,49.31';

function normalizeQuery(trimmed) {
    const lower = trimmed.toLowerCase();
    if (lower.includes('vancouver') && (lower.includes('bc') || lower.includes('british columbia') || lower.includes('canada')))
        return trimmed;
    if (lower.includes('vancouver')) return `${trimmed}, BC Canada`;
    return `${trimmed}, Vancouver BC Canada`;
}

async function nominatim(q) {
    const params = new URLSearchParams({
        q, format: 'json', limit: '5', addressdetails: '1',
        countrycodes: 'ca', viewbox: VANCOUVER_VIEWBOX, bounded: '0',
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((item) => ({ lat: parseFloat(item.lat), lng: parseFloat(item.lon), displayName: item.display_name }));
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const q = req.query.q;
    if (!q || typeof q !== 'string' || q.trim().length < 3) {
        return res.status(400).json({ error: 'Missing or too-short q parameter' });
    }

    try {
        const trimmed = q.trim();
        let results = await nominatim(normalizeQuery(trimmed));

        // Fallback: strip leading street number
        if (results.length === 0) {
            const withoutNumber = trimmed.replace(/^\d+\s+/, '').trim();
            if (withoutNumber.length >= 3 && withoutNumber !== trimmed) {
                results = await nominatim(normalizeQuery(withoutNumber));
            }
        }

        if (results.length === 0) return res.status(404).json({ error: 'Address not found' });
        res.json(results.slice(0, 5));
    } catch (err) {
        console.error('Geocode error:', err);
        res.status(500).json({ error: err.message || 'Geocoding failed' });
    }
}
