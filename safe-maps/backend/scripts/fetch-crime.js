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
console.log(`Checking for crime data in: ${CRIME_DIR}`);
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

/**
 * Converts UTM Zone 10N (Vancouver) to Lat/Lng.
 * Based on standard UTM conversion formula.
 */
function utmToLatLng(x, y) {
    const easting = x;
    const northing = y;
    const zone = 10;

    const sa = 6378137.0;
    const sb = 6356752.314245;
    const e = Math.sqrt(1 - Math.pow(sb / sa, 2));
    const e2 = Math.pow(e, 2) / (1 - Math.pow(e, 2));
    const n = (sa - sb) / (sa + sb);

    const M = northing / 0.9996;
    const mu = M / (sa * (1 - Math.pow(e, 2) / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256));

    const e1 = (1 - Math.pow(1 - Math.pow(e, 2), 0.5)) / (1 + Math.pow(1 - Math.pow(e, 2), 0.5));
    const J1 = (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32);
    const J2 = (21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32);
    const J3 = (151 * Math.pow(e1, 3) / 96);
    const J4 = (1097 * Math.pow(e1, 4) / 512);

    const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu) + J3 * Math.sin(6 * mu) + J4 * Math.sin(8 * mu);

    const C1 = e2 * Math.pow(Math.cos(fp), 2);
    const T1 = Math.pow(Math.tan(fp), 2);
    const R1 = sa * (1 - Math.pow(e, 2)) / Math.pow(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2), 1.5);
    const N1 = sa / Math.sqrt(1 - Math.pow(e, 2) * Math.pow(Math.sin(fp), 2));
    const D = (easting - 500000) / (N1 * 0.9996);

    const lat = fp - (N1 * Math.tan(fp) / R1) * (Math.pow(D, 2) / 2 - (5 + 3 * T1 + 10 * C1 - 4 * Math.pow(C1, 2) - 9 * e2) * Math.pow(D, 4) / 24 + (61 + 90 * T1 + 298 * C1 + 45 * Math.pow(T1, 2) - 252 * e2 - 3 * Math.pow(C1, 2)) * Math.pow(D, 6) / 720);
    const lng = (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 + (5 - 2 * C1 + 28 * T1 - 3 * Math.pow(C1, 2) + 8 * e2 + 24 * Math.pow(T1, 2)) * Math.pow(D, 5) / 120) / Math.cos(fp);

    return {
        lat: lat * 180 / Math.PI,
        lng: -123 + (lng * 180 / Math.PI)
    };
}

function loadFromCSVs() {
    if (!fs.existsSync(CRIME_DIR)) return null;
    const allFiles = fs.readdirSync(CRIME_DIR);
    console.log(`Directory ${CRIME_DIR} contains: ${allFiles.join(', ')}`);
    const files = allFiles.filter(f => f.endsWith('.csv'));
    if (files.length === 0) return null;

    const grid = {};
    for (const file of files) {
        const content = fs.readFileSync(path.join(CRIME_DIR, file), 'utf8');
        const lines = content.split('\n').filter(Boolean);
        if (lines.length < 2) continue;

        const headers = parseCSVLine(lines[0]);
        console.log(`Headers in ${file}: ${headers.join('|')}`);
        const { latIdx, lngIdx } = findLatLngColumns(headers);

        const latCol = headers.findIndex(h => /^(y|lat|latitude)$/i.test(h.trim()));
        const lngCol = headers.findIndex(h => /^(x|lon|lng|longitude|long)$/i.test(h.trim()));

        const useLat = latCol >= 0 ? latCol : latIdx;
        const useLng = lngCol >= 0 ? lngCol : lngIdx;

        console.log(`Using columns: lat=${useLat} ("${headers[useLat]}"), lng=${useLng} ("${headers[useLng]}")`);

        if (useLat < 0 || useLng < 0) {
            console.warn(`Skipping ${file}: could not find lat/lng columns`);
            continue;
        }

        let count = 0;
        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            if (cols.length <= Math.max(useLat, useLng)) continue;

            let lat = parseFloat(cols[useLat]);
            let lng = parseFloat(cols[useLng]);

            // Check if coordinates look like UTM (Vancouver X/Y are usually 490XXX / 545XXXX)
            if (lat > 100000 || lng > 100000) {
                const x = Math.min(lat, lng);
                const y = Math.max(lat, lng);
                const converted = utmToLatLng(x, y);
                lat = converted.lat;
                lng = converted.lng;
            }

            if (isNaN(lat) || isNaN(lng) || lat < 49.1 || lat > 49.4 || lng < -123.3 || lng > -123.0) continue;
            const cellId = getCellId(lat, lng);
            grid[cellId] = (grid[cellId] || 0) + 1;
            count++;
        }
        console.log(`Included ${count} points from ${file}`);
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
