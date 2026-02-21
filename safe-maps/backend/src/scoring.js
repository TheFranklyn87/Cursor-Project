/**
 * Safety scoring engine - scores route segments using crime grid and lighting data
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

let crimeGrid = null;
let lightingData = null;
let maxCrime = 0;
let maxLights = 0;
let dataUnavailable = false;

const GRID_SIZE = 0.001;
const SAMPLE_INTERVAL_M = 50;
const LIGHT_RADIUS_M = 75;
const M_TO_DEG_approx = 1 / 111320; // at Vancouver latitude

function loadData() {
    if (dataUnavailable) return;
    try {
        if (!crimeGrid) {
            const crimePath = join(DATA_DIR, 'crime-grid.json');
            if (!existsSync(crimePath)) {
                console.warn('crime-grid.json not found. Run: node scripts/fetch-crime.js');
                dataUnavailable = true;
                return;
            }
            const raw = readFileSync(crimePath, 'utf8');
            const parsed = JSON.parse(raw);
            crimeGrid = parsed.grid;
            maxCrime = Math.max(...Object.values(crimeGrid), 1);
        }
        if (!lightingData) {
            const lightingPath = join(DATA_DIR, 'lighting.json');
            if (!existsSync(lightingPath)) {
                console.warn('lighting.json not found. Run: node scripts/fetch-lighting.js');
                dataUnavailable = true;
                return;
            }
            const raw = readFileSync(lightingPath, 'utf8');
            lightingData = JSON.parse(raw);
            const poles = lightingData.poles || [];
            const grid = lightingData.grid || {};
            maxLights = Math.max(...Object.values(grid), 1);
            if (maxLights === 1 && poles.length > 0) {
                const gridVals = Object.values(grid);
                maxLights = gridVals.length ? Math.max(...gridVals) : 1;
            }
        }
    } catch (err) {
        console.warn('Could not load safety data:', err.message);
        dataUnavailable = true;
    }
}

function getCellId(lat, lng) {
    const latCell = Math.floor(lat / GRID_SIZE);
    const lngCell = Math.floor(lng / GRID_SIZE);
    return `${latCell}_${lngCell}`;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function samplePointsAlongRoute(coords) {
    const points = [];
    let accDist = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        const [lng1, lat1] = coords[i];
        const [lng2, lat2] = coords[i + 1];
        const segDist = haversineDistance(lat1, lng1, lat2, lng2);
        const numSamples = Math.max(1, Math.floor(segDist / SAMPLE_INTERVAL_M));
        for (let j = 0; j <= numSamples; j++) {
            const t = j / numSamples;
            points.push([lat1 + t * (lat2 - lat1), lng1 + t * (lng2 - lng1)]);
        }
        accDist += segDist;
    }
    if (coords.length > 0) {
        const [lng, lat] = coords[coords.length - 1];
        points.push([lat, lng]);
    }
    return points;
}

function getCrimeAt(lat, lng) {
    const cellId = getCellId(lat, lng);
    return crimeGrid[cellId] || 0;
}

function getLightingAtFromGrid(lat, lng) {
    const grid = lightingData.grid || {};
    const gs = lightingData.gridSize || GRID_SIZE;
    const radiusCells = Math.ceil((LIGHT_RADIUS_M * M_TO_DEG_approx) / gs);
    const latCell = Math.floor(lat / gs);
    const lngCell = Math.floor(lng / gs);
    let count = 0;
    for (let di = -radiusCells; di <= radiusCells; di++) {
        for (let dj = -radiusCells; dj <= radiusCells; dj++) {
            const cellId = `${latCell + di}_${lngCell + dj}`;
            count += grid[cellId] || 0;
        }
    }
    return count;
}

export function scoreRoute(route, night = false) {
    loadData();
    const coords = route.geometry?.coordinates || [];
    if (coords.length < 2 || dataUnavailable || !crimeGrid || !lightingData) {
        return { safetyScore: 50, crimeScore: 50, lightingScore: 50, segments: [], dangerPoints: [] };
    }

    const points = samplePointsAlongRoute(coords);
    const lightingWeight = night ? 0.5 : 0.1;
    const crimeWeight = night ? 0.5 : 0.9;

    const logMaxCrime = Math.log1p(maxCrime);
    const logMaxLights = Math.log1p(maxLights);

    let totalNormCrime = 0;
    let totalNormLights = 0;

    const scoredPoints = points.map(([lat, lng]) => {
        const crime = getCrimeAt(lat, lng);
        const lights = getLightingAtFromGrid(lat, lng);
        const normLights = logMaxLights > 0 ? Math.log1p(lights) / logMaxLights : 0;
        const normCrime = logMaxCrime > 0 ? Math.log1p(crime) / logMaxCrime : 0;

        totalNormCrime += normCrime;
        totalNormLights += normLights;

        const localSafety = (lightingWeight * normLights) - (crimeWeight * normCrime);
        return { lat, lng, localSafety, crime: normCrime };
    });

    const avgSafety = scoredPoints.length > 0
        ? scoredPoints.reduce((acc, p) => acc + p.localSafety, 0) / scoredPoints.length
        : 0;

    const safetyScore = Math.round(Math.max(0, Math.min(100, 50 + avgSafety * 100)));

    // Crime and lighting scores for breakdown (0-100)
    const avgCrimeNorm = scoredPoints.length > 0 ? totalNormCrime / scoredPoints.length : 0;
    const avgLightsNorm = scoredPoints.length > 0 ? totalNormLights / scoredPoints.length : 0;
    const crimeScore = Math.round((1 - avgCrimeNorm) * 100);
    const lightingScore = Math.round(avgLightsNorm * 100);

    // Identify danger points (hotspots)
    const dangerPoints = scoredPoints
        .filter(p => p.crime > 0.4)
        .map(p => ({ lat: p.lat, lng: p.lng, intensity: p.crime }));

    // Create segments for visualization
    const segments = [];
    for (let i = 0; i < scoredPoints.length - 1; i++) {
        const p1 = scoredPoints[i];
        const p2 = scoredPoints[i + 1];
        const avgLocalSafety = (p1.localSafety + p2.localSafety) / 2;
        const score = Math.round(Math.max(0, Math.min(100, 50 + avgLocalSafety * 100)));
        segments.push({
            coords: [[p1.lng, p1.lat], [p2.lng, p2.lat]],
            score
        });
    }

    return { safetyScore, crimeScore, lightingScore, segments, dangerPoints };
}

