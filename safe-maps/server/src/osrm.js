/**
 * OSRM routing client - fetches walking routes from public OSRM server
 */

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot';

export async function getRoutes(fromLat, fromLng, toLat, toLng) {
  const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
  const url = `${OSRM_BASE}/${coords}?alternatives=2&geometries=geojson&overview=full`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OSRM error: ${res.status} - ${err}`);
  }
  const data = await res.json();
  if (data.code !== 'Ok') {
    throw new Error(data.message || 'OSRM routing failed');
  }
  return data.routes.map((r) => ({
    geometry: r.geometry,
    duration: r.duration,
    distance: r.distance,
  }));
}
