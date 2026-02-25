/**
 * Vercel Serverless Function: GET /api/route
 */
'use strict';




// ── OSRM ─────────────────────────────────────────────────────────────────────
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot';

async function fetchOsrmRoutes(coordsString) {
    const url = `${OSRM_BASE}/${coordsString}?alternatives=3&geometries=geojson&overview=full`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.code !== 'Ok') return [];
    return data.routes.map((r) => ({ geometry: r.geometry, duration: r.duration, distance: r.distance }));
}

async function getRoutes(fromLat, fromLng, toLat, toLng) {
    const directCoords = `${fromLng},${fromLat};${toLng},${toLat}`;
    let routes = await fetchOsrmRoutes(directCoords);

    if (routes.length < 3) {
        const midLat = (fromLat + toLat) / 2;
        const midLng = (fromLng + toLng) / 2;
        const dLat = toLat - fromLat;
        const dLng = toLng - fromLng;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        const offset = dist * 0.15;
        const pLat = -dLng / (dist || 1);
        const pLng = dLat / (dist || 1);
        const viaPoints = [
            { lat: midLat + pLat * offset, lng: midLng + pLng * offset },
            { lat: midLat - pLat * offset, lng: midLng - pLng * offset },
        ];
        for (const via of viaPoints) {
            const viaCoords = `${fromLng},${fromLat};${via.lng},${via.lat};${toLng},${toLat}`;
            const viaRoutes = await fetchOsrmRoutes(viaCoords);
            if (viaRoutes.length) {
                const exists = routes.some((r) => Math.abs(r.distance - viaRoutes[0].distance) < 5);
                if (!exists) routes.push(viaRoutes[0]);
            }
            if (routes.length >= 4) break;
        }
    }
    return routes;
}

// ── Cache (in-memory per warm instance) ──────────────────────────────────────
const TTL_MS = 10 * 60 * 1000;
const _cache = new Map();
function roundCoord(n) { return Math.round(n * 10000) / 10000; }
function cacheKey(a, b, c, d) { return `${roundCoord(a)},${roundCoord(b)};${roundCoord(c)},${roundCoord(d)}`; }
function cacheGet(a, b, c, d) {
    const entry = _cache.get(cacheKey(a, b, c, d));
    if (!entry || Date.now() > entry.expiresAt) return null;
    return entry.data;
}
function cacheSet(a, b, c, d, data) {
    _cache.set(cacheKey(a, b, c, d), { data, expiresAt: Date.now() + TTL_MS });
}

// ── Scoring ───────────────────────────────────────────────────────────────────
const GRID_SIZE = 0.001;
const SAMPLE_INTERVAL_M = 50;
const LIGHT_RADIUS_M = 75;
const M_TO_DEG = 1 / 111320;

let crimeGrid = null, lightingData = null, maxCrime = 0, maxLights = 0, dataUnavailable = false;

function loadData() {
    if (dataUnavailable || (crimeGrid && lightingData)) return;
    try {
        if (!crimeGrid) {
            // require() ensures these are bundled in the Vercel function
            const parsed = require('../backend/src/data/crime-grid.json');
            crimeGrid = parsed.grid;
            maxCrime = Math.max(...Object.values(crimeGrid) || [1], 1);
        }
        if (!lightingData) {
            lightingData = require('../backend/src/data/lighting.json');
            const grid = lightingData.grid || {};
            maxLights = Math.max(...Object.values(grid) || [1], 1);
        }
    } catch (err) {
        console.warn('Could not load safety data:', err.message);
        dataUnavailable = true;
    }
}

function getCellId(lat, lng) {
    return `${Math.floor(lat / GRID_SIZE)}_${Math.floor(lng / GRID_SIZE)}`;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function samplePoints(coords) {
    const points = [];
    for (let i = 0; i < coords.length - 1; i++) {
        const [lng1, lat1] = coords[i];
        const [lng2, lat2] = coords[i + 1];
        const n = Math.max(1, Math.floor(haversineDistance(lat1, lng1, lat2, lng2) / SAMPLE_INTERVAL_M));
        for (let j = 0; j <= n; j++) {
            const t = j / n;
            points.push([lat1 + t * (lat2 - lat1), lng1 + t * (lng2 - lng1)]);
        }
    }
    if (coords.length > 0) { const [lng, lat] = coords[coords.length - 1]; points.push([lat, lng]); }
    return points;
}

function getLightingCount(lat, lng) {
    const grid = lightingData.grid || {};
    const gs = lightingData.gridSize || GRID_SIZE;
    const rc = Math.ceil((LIGHT_RADIUS_M * M_TO_DEG) / gs);
    const latCell = Math.floor(lat / gs);
    const lngCell = Math.floor(lng / gs);
    let count = 0;
    for (let di = -rc; di <= rc; di++)
        for (let dj = -rc; dj <= rc; dj++)
            count += grid[`${latCell + di}_${lngCell + dj}`] || 0;
    return count;
}

function scoreRoute(route, night) {
    loadData();
    const coords = route.geometry && route.geometry.coordinates || [];
    if (coords.length < 2 || dataUnavailable || !crimeGrid || !lightingData)
        return { safetyScore: 50, crimeScore: 50, lightingScore: 50, segments: [], dangerPoints: [] };

    const points = samplePoints(coords);
    const lw = night ? 0.5 : 0.1;
    const cw = night ? 0.5 : 0.9;
    const logMaxCrime = Math.log1p(maxCrime);
    const logMaxLights = Math.log1p(maxLights);
    let totalCrime = 0, totalLights = 0;

    const scoredPoints = points.map(([lat, lng]) => {
        const crime = crimeGrid[getCellId(lat, lng)] || 0;
        const lights = getLightingCount(lat, lng);
        const normLights = logMaxLights > 0 ? Math.log1p(lights) / logMaxLights : 0;
        const normCrime = logMaxCrime > 0 ? Math.log1p(crime) / logMaxCrime : 0;
        totalCrime += normCrime; totalLights += normLights;
        return { lat, lng, localSafety: lw * normLights - cw * normCrime, crime: normCrime };
    });

    const n = scoredPoints.length || 1;
    const avgSafety = scoredPoints.reduce((a, p) => a + p.localSafety, 0) / n;
    const safetyScore = Math.round(Math.max(0, Math.min(100, 60 + avgSafety * 120)));
    const crimeScore = Math.round((1 - totalCrime / n) * 100);
    const lightingScore = Math.round((totalLights / n) * 100);
    const dangerPoints = scoredPoints.filter(p => p.crime > 0.4).map(p => ({ lat: p.lat, lng: p.lng, intensity: p.crime }));
    const segments = [];
    for (let i = 0; i < scoredPoints.length - 1; i++) {
        const p1 = scoredPoints[i], p2 = scoredPoints[i + 1];
        const score = Math.round(Math.max(0, Math.min(100, 60 + ((p1.localSafety + p2.localSafety) / 2) * 120)));
        segments.push({ coords: [[p1.lng, p1.lat], [p2.lng, p2.lat]], score });
    }
    return { safetyScore, crimeScore, lightingScore, segments, dangerPoints };
}

// ── Handler ───────────────────────────────────────────────────────────────────
function parseCoord(param) {
    if (!param) return null;
    const parts = param.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length !== 2 || parts.some(isNaN)) return null;
    return { lat: parts[0], lng: parts[1] };
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const from = parseCoord(req.query.from);
    const to = parseCoord(req.query.to);
    const night = req.query.night === 'true' || req.query.night === '1';

    if (!from || !to) {
        return res.status(400).json({ error: 'Missing or invalid from/to. Use: ?from=lat,lng&to=lat,lng' });
    }

    try {
        let osmRoutes = cacheGet(from.lat, from.lng, to.lat, to.lng);
        if (!osmRoutes) {
            osmRoutes = await getRoutes(from.lat, from.lng, to.lat, to.lng);
            if (osmRoutes && osmRoutes.length) cacheSet(from.lat, from.lng, to.lat, to.lng, osmRoutes);
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
                crimeScore: crimeScore != null ? crimeScore : 50,
                lightingScore: lightingScore != null ? lightingScore : 50,
                segments,
                dangerPoints,
            };
        });

        const safestOptions = scored.map((r, i) => ({ i, s: r.safetyScore })).sort((a, b) => b.s - a.s).slice(0, 3).map(x => x.i);
        const fastestOptions = scored.map((r, i) => ({ i, d: r.duration })).sort((a, b) => a.d - b.d).slice(0, 3).map(x => x.i);

        res.json({ routes: scored, recommended: safestOptions[0] || 0, fastest: fastestOptions[0] || 0, safestOptions, fastestOptions });
    } catch (err) {
        console.error('Route error:', err);
        res.status(500).json({ error: err.message || 'Routing failed' });
    }
};
