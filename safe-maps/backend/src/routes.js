/**
 * Route API - GET /api/route?from=lat,lng&to=lat,lng&night=true|false
 */

import { getRoutes } from './osrm.js';
import { scoreRoute } from './scoring.js';

function parseCoord(param) {
    const parts = param.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length !== 2 || parts.some(isNaN)) return null;
    return { lat: parts[0], lng: parts[1] };
}

export async function handleRouteRequest(req, res) {
    const from = parseCoord(req.query.from);
    const to = parseCoord(req.query.to);
    const night = req.query.night === 'true' || req.query.night === '1';

    if (!from || !to) {
        return res.status(400).json({
            error: 'Missing or invalid from/to. Use: ?from=lat,lng&to=lat,lng',
        });
    }

    try {
        let osmRoutes = await getRoutes(from.lat, from.lng, to.lat, to.lng);
        if (!osmRoutes || osmRoutes.length === 0) {
            return res.status(404).json({ error: 'No route found' });
        }

        const scored = osmRoutes.map((r) => {
            const { safetyScore, segments, dangerPoints } = scoreRoute(r, night);
            return {
                geometry: r.geometry,
                duration: Math.round(r.duration),
                distance: Math.round(r.distance),
                safetyScore,
                segments,
                dangerPoints,
            };
        });

        let recommended = 0;
        let bestScore = scored[0].safetyScore;
        for (let i = 1; i < scored.length; i++) {
            if (scored[i].safetyScore > bestScore) {
                bestScore = scored[i].safetyScore;
                recommended = i;
            }
        }

        res.json({
            routes: scored,
            recommended,
        });
    } catch (err) {
        console.error('Route error:', err);
        res.status(500).json({
            error: err.message || 'Routing failed',
        });
    }
}
const VANCOUVER_BBOX = '-123.27,49.19,-123.01,49.32';

export async function handleGeocode(req, res) {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing query' });

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&viewbox=${VANCOUVER_BBOX}&bounded=1&limit=5`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Safe-Maps-Vancouver/1.0' }
        });
        const data = await response.json();

        const suggestions = data.map(item => ({
            display_name: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon)
        }));

        res.json(suggestions);
    } catch (err) {
        console.error('Geocode error:', err);
        res.status(500).json({ error: 'Geocoding failed' });
    }
}
