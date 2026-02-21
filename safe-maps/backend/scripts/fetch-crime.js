/**
 * Builds crime density grid from VPD GeoDASH CSV files.
 * Place downloaded CSV files in data/crime/ directory.
 * If no CSVs found, generates a demo grid based on known Vancouver crime patterns.
 * Output: crime-grid.json
 */

const fs = require('fs');
const path = require('path');

const CRIME_DIR = path.join(__dirname, '../data/crime');
const OUTPUT_DIR = path.join(__dirname, '../src/data');
const GRID_SIZE = 0.001; // ~100m at Vancouver latitude

// Demo crime hotspots for Vancouver (approximate centroids from public knowledge)
// East Hastings, Downtown, Gastown, Strathcona - higher density
const DEMO_HOTSPOTS = [
    { lat: 49.2827, lng: -123.1045, weight: 8 },   // East Hastings
    { lat: 49.2834, lng: -123.1118, weight: 6 },   // Gastown
    { lat: 49.2776, lng: -123.0990, weight: 5 },   // Strathcona
    { lat: 49.2824, lng: -123.1206, weight: 4 },   // Downtown core
    { lat: 49.2722, lng: -123.1000, weight: 3 },   // Mount Pleasant edge
    { lat: 49.2650, lng: -123.1150, weight: 2 },   // Fairview
];

function getCellId(lat, lng) {
    const latCell = Math.floor(lat / GRID_SIZE);
    const lngCell = Math.floor(lng / GRID_SIZE);
    return `${latCell}_${lngCell}`;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            inQuotes = !inQuotes;
        } else if ((c === ',' || c === '\t') && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += c;
        }
    }
    result.push(current.trim());
    return result;
}

function findLatLngColumns(headers) {
    const h = headers.map(x => x.toLowerCase());
    let latIdx = h.findIndex(x => x.includes('lat') || x === 'y' || x === 'latitude');
    let lngIdx = h.findIndex(x => x.includes('lon') || x.includes('lng') || x === 'x' || x === 'longitude');
    if (latIdx < 0) latIdx = h.findIndex(x => x.includes('coord'));
    return { latIdx, lngIdx };
}

function loadFromCSVs() {
    if (!fs.existsSync(CRIME_DIR)) return null;
    const files = fs.readdirSync(CRIME_DIR).filter(f => f.endsWith('.csv'));
    if (files.length === 0) return null;

    const grid = {};
    for (const file of files) {
        const content = fs.readFileSync(path.join(CRIME_DIR, file), 'utf8');
        const lines = content.split('\n').filter(Boolean);
        if (lines.length < 2) continue;

        const headers = parseCSVLine(lines[0]);
        const { latIdx, lngIdx } = findLatLngColumns(headers);

        // Try common VPD column names
        const latCol = headers.findIndex(h => /lat|y|latitude/i.test(h));
        const lngCol = headers.findIndex(h => /lon|lng|x|longitude|long/i.test(h));

        const useLat = latCol >= 0 ? latCol : latIdx;
        const useLng = lngCol >= 0 ? lngCol : lngIdx;

        if (useLat < 0 || useLng < 0) {
            console.warn(`Skipping ${file}: could not find lat/lng columns`);
            continue;
        }

        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            const lat = parseFloat(cols[useLat]);
            const lng = parseFloat(cols[useLng]);
            if (isNaN(lat) || isNaN(lng) || lat < 49.1 || lat > 49.4 || lng < -123.3 || lng > -123.0) continue;
            const cellId = getCellId(lat, lng);
            grid[cellId] = (grid[cellId] || 0) + 1;
        }
    }
    return Object.keys(grid).length > 0 ? grid : null;
}

function generateDemoGrid() {
    const grid = {};
    const spread = 3; // cells to spread each hotspot
    for (const spot of DEMO_HOTSPOTS) {
        const baseLat = Math.floor(spot.lat / GRID_SIZE) * GRID_SIZE;
        const baseLng = Math.floor(spot.lng / GRID_SIZE) * GRID_SIZE;
        for (let di = -spread; di <= spread; di++) {
            for (let dj = -spread; dj <= spread; dj++) {
                const lat = baseLat + (di + 0.5) * GRID_SIZE;
                const lng = baseLng + (dj + 0.5) * GRID_SIZE;
                const dist = Math.sqrt(di * di + dj * dj);
                const count = Math.max(0, Math.round(spot.weight * (1 - dist / (spread + 1))));
                if (count > 0) {
                    const cellId = getCellId(lat, lng);
                    grid[cellId] = (grid[cellId] || 0) + count;
                }
            }
        }
    }
    return grid;
}

function main() {
    let grid = loadFromCSVs();
    let source = 'CSV files';

    if (!grid || Object.keys(grid).length === 0) {
        console.log('No crime CSV files found in data/crime/. Using demo grid.');
        grid = generateDemoGrid();
        source = 'demo (place VPD CSV files in data/crime/ for real data)';
    } else {
        console.log('Loaded crime data from CSV files.');
    }

    const output = {
        grid,
        gridSize: GRID_SIZE,
        metadata: { source, builtAt: new Date().toISOString() }
    };

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.mkdirSync(CRIME_DIR, { recursive: true });
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'crime-grid.json'),
        JSON.stringify(output, null, 0),
        'utf8'
    );

    console.log(`Saved to ${OUTPUT_DIR}/crime-grid.json (${Object.keys(grid).length} cells)`);
}

main();
