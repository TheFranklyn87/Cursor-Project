/**
 * Route API - GET /api/route?from=lat,lng&to=lat,lng&night=true|false
 * Geocode API - GET /api/geocode?q=address
 */

import { getRoutes } from './osrm.js';
import { geocode } from './geocode.js';
import * as cache from './cache.js';
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
        let osmRoutes = cache.get(from.lat, from.lng, to.lat, to.lng);
        if (!osmRoutes) {
            osmRoutes = await getRoutes(from.lat, from.lng, to.lat, to.lng);
            if (osmRoutes?.length) {
                cache.set(from.lat, from.lng, to.lat, to.lng, osmRoutes);
            }
        }
        if (!osmRoutes || osmRoutes.length === 0) {
            return res.status(404).json({ error: 'No route found' });
        }

        const scored = osmRoutes.map((r) => {
            const { safetyScore, crimeScore, lightingScore, segments, dangerPoints } = scoreRoute(r, night);
            return {
                geometry: r.geometry,
                duration: Math.round(r.duration),
                distance: Math.round(r.distance),
                safetyScore,
                crimeScore: crimeScore ?? 50,
                lightingScore: lightingScore ?? 50,
                segments,
                dangerPoints,
            };
        });

        // Safest: top 3 by safety (safest first; can be longer)
        const safestOptions = scored
            .map((r, i) => ({ i, safetyScore: r.safetyScore }))
            .sort((a, b) => b.safetyScore - a.safetyScore)
            .slice(0, 3)
            .map((x) => x.i);

        // Fastest: top 3 by duration (fastest first; safety ignored)
        const fastestOptions = scored
            .map((r, i) => ({ i, duration: r.duration }))
            .sort((a, b) => a.duration - b.duration)
            .slice(0, 3)
            .map((x) => x.i);

        res.json({
            routes: scored,
            recommended: safestOptions[0] ?? 0,
            fastest: fastestOptions[0] ?? 0,
            safestOptions,
            fastestOptions,
        });
    } catch (err) {
        console.error('Route error:', err);
        res.status(500).json({
            error: err.message || 'Routing failed',
        });
    }
}

export async function handleGeocodeRequest(req, res) {
    const q = req.query.q;
    if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Missing q parameter' });
    }
    try {
        const result = await geocode(q);
        if (!Array.isArray(result) || result.length === 0) {
            return res.status(404).json({ error: 'Address not found' });
        }
        res.json(result);
    } catch (err) {
        console.error('Geocode error:', err);
        res.status(500).json({ error: err.message || 'Geocoding failed' });
    }
}

