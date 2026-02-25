/**
 * OSRM routing client - fetches walking routes from public OSRM server
 */

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot';

async function fetchRoutes(coordsString) {
    const url = `${OSRM_BASE}/${coordsString}?alternatives=3&geometries=geojson&overview=full`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.code !== 'Ok') return [];
    return data.routes.map((r) => ({
        geometry: r.geometry,
        duration: r.duration,
        distance: r.distance,
    }));
}

export async function getRoutes(fromLat, fromLng, toLat, toLng) {
    const directCoords = `${fromLng},${fromLat};${toLng},${toLat}`;
    let routes = await fetchRoutes(directCoords);

    // If OSRM didn't give enough alternatives, force them with via-points
    if (routes.length < 3) {
        // Calculate midpoint
        const midLat = (fromLat + toLat) / 2;
        const midLng = (fromLng + toLng) / 2;

        // Perpendicular offset (approx 15% of distance)
        const dLat = toLat - fromLat;
        const dLng = toLng - fromLng;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        const offset = dist * 0.15;

        // Perpendicular vector: (-dLng, dLat) normalized
        const pLat = -dLng / (dist || 1);
        const pLng = dLat / (dist || 1);

        const viaPoints = [
            { lat: midLat + pLat * offset, lng: midLng + pLng * offset },
            { lat: midLat - pLat * offset, lng: midLng - pLng * offset }
        ];

        for (const via of viaPoints) {
            const viaCoords = `${fromLng},${fromLat};${via.lng},${via.lat};${toLng},${toLat}`;
            const viaRoutes = await fetchRoutes(viaCoords);
            if (viaRoutes.length) {
                // Check for duplicates based on distance (crude but effective)
                const exists = routes.some(r => Math.abs(r.distance - viaRoutes[0].distance) < 5);
                if (!exists) routes.push(viaRoutes[0]);
            }
            if (routes.length >= 4) break;
        }
    }

    return routes;
}
