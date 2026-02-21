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

export async function handleGeocodeRequest(req, res) {
    const q = req.query.q;
    if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Missing q parameter' });
    }
    try {
        const result = await geocode(q);
        if (!result) {
            return res.status(404).json({ error: 'Address not found' });
        }
        // Handle both single result and array of results if needed
        // The suggest endpoint in frontend expects an array
        res.json(Array.isArray(result) ? result : [result]);
    } catch (err) {
        console.error('Geocode error:', err);
        res.status(500).json({ error: err.message || 'Geocoding failed' });
    }
}

