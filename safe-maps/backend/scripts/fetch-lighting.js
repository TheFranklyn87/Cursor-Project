/**
 * Fetches street lighting poles from Vancouver Open Data API
 * and builds a spatial index (grid) for radius queries.
 * Output: lighting.json with poles array and grid for fast lookup
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_BASE = 'https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/street-lighting-poles/records';
const BATCH_SIZE = 100;
const OUTPUT_DIR = path.join(__dirname, '../src/data');
const GRID_SIZE = 0.001; // ~100m at Vancouver latitude

async function fetchBatch(offset) {
    return new Promise((resolve, reject) => {
        const url = `${API_BASE}?limit=${BATCH_SIZE}&offset=${offset}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function getCellId(lat, lng) {
    const latCell = Math.floor(lat / GRID_SIZE);
    const lngCell = Math.floor(lng / GRID_SIZE);
    return `${latCell}_${lngCell}`;
}

async function main() {
    console.log('Fetching street lighting data from Vancouver Open Data...');

    let offset = 0;
    let totalCount = null;
    const allPoles = [];
    const gridCounts = {};

    while (true) {
        const response = await fetchBatch(offset);
        if (totalCount === null) {
            totalCount = response.total_count;
            console.log(`Total poles: ${totalCount}`);
        }

        const results = response.results || [];
        if (results.length === 0) break;

        for (const record of results) {
            const pt = record.geo_point_2d || record.geom?.geometry?.coordinates;
            if (!pt) continue;
            const lon = pt.lon ?? pt[0];
            const lat = pt.lat ?? pt[1];
            if (lat == null || lon == null) continue;

            allPoles.push([lat, lon]);
            const cellId = getCellId(lat, lon);
            gridCounts[cellId] = (gridCounts[cellId] || 0) + 1;
        }

        offset += BATCH_SIZE;
        process.stdout.write(`\rFetched ${Math.min(offset, totalCount)}/${totalCount} poles...`);

        if (results.length < BATCH_SIZE) break;
        await new Promise(r => setTimeout(r, 100)); // rate limit
    }

    console.log('\nBuilding output...');

    const output = {
        poles: allPoles,
        grid: gridCounts,
        gridSize: GRID_SIZE,
        metadata: { totalPoles: allPoles.length, fetchedAt: new Date().toISOString() }
    };

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'lighting.json'),
        JSON.stringify(output, null, 0),
        'utf8'
    );

    console.log(`Saved to ${OUTPUT_DIR}/lighting.json (${allPoles.length} poles)`);
}

main().catch(console.error);
