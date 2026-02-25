/**
 * In-memory cache for OSRM responses. Key: from+to (rounded to 4 decimals).
 * TTL: 10 minutes. Reduces load on public OSRM server.
 */

const TTL_MS = 10 * 60 * 1000;

const cache = new Map();

function roundCoord(n) {
  return Math.round(n * 10000) / 10000;
}

function cacheKey(fromLat, fromLng, toLat, toLng) {
  return `${roundCoord(fromLat)},${roundCoord(fromLng)};${roundCoord(toLat)},${roundCoord(toLng)}`;
}

export function get(fromLat, fromLng, toLat, toLng) {
  const key = cacheKey(fromLat, fromLng, toLat, toLng);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function set(fromLat, fromLng, toLat, toLng, data) {
  const key = cacheKey(fromLat, fromLng, toLat, toLng);
  cache.set(key, {
    data,
    expiresAt: Date.now() + TTL_MS,
  });
}
