import { getRoutes } from './backend/src/osrm.js';

async function test() {
    const fromLat = 49.263;
    const fromLng = -123.168; // West 12th & Trutch
    const toLat = 49.263;
    const toLng = -123.150;   // West 12th & MacDonald

    console.log(`Fetching routes from ${fromLat},${fromLng} to ${toLat},${toLng}`);
    const routes = await getRoutes(fromLat, fromLng, toLat, toLng);
    console.log(`Got ${routes.length} routes.`);
    routes.forEach((r, i) => {
        console.log(`Route ${i + 1}: Distance = ${r.distance}m, Duration = ${r.duration}s`);
    });
}

test().catch(console.error);
