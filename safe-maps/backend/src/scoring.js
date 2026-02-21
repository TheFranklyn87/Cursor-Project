/**
 * Safety scoring engine - scores route segments using crime grid and lighting data
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

let crimeGrid = null;
let lightingData = null;
let maxCrime = 0;
let maxLights = 0;

const GRID_SIZE = 0.001;
const SAMPLE_INTERVAL_M = 50;
const LIGHT_RADIUS_M = 75;
const M_TO_DEG_approx = 1 / 111320; // at Vancouver latitude

function loadData() {
  if (!crimeGrid) {
    const raw = readFileSync(join(DATA_DIR, 'crime-grid.json'), 'utf8');
    const parsed = JSON.parse(raw);
    crimeGrid = parsed.grid;
    maxCrime = Math.max(...Object.values(crimeGrid), 1);
  }
  if (!lightingData) {
    const raw = readFileSync(join(DATA_DIR, 'lighting.json'), 'utf8');
    lightingData = JSON.parse(raw);
    const poles = lightingData.poles || [];
    const grid = lightingData.grid || {};
    maxLights = Math.max(...Object.values(grid), 1);
    if (maxLights === 1 && poles.length > 0) {
      const gridVals = Object.values(grid);
      maxLights = gridVals.length ? Math.max(...gridVals) : 1;
    }
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
  if (coords.length < 2) return { safetyScore: 50 };

  const points = samplePointsAlongRoute(coords);
  const lightingWeight = night ? 0.5 : 0.1;
  const crimeWeight = night ? 0.5 : 0.9;

  let totalSafety = 0;
  for (const [lat, lng] of points) {
    const crime = getCrimeAt(lat, lng);
    const lights = getLightingAtFromGrid(lat, lng);
    const normLights = maxLights > 0 ? lights / maxLights : 0;
    const normCrime = maxCrime > 0 ? crime / maxCrime : 0;
    totalSafety += lightingWeight * normLights - crimeWeight * normCrime;
  }
  const avgSafety = points.length > 0 ? totalSafety / points.length : 0;
  const safetyScore = Math.round(Math.max(0, Math.min(100, 50 + avgSafety * 50)));
  return { safetyScore };
}
