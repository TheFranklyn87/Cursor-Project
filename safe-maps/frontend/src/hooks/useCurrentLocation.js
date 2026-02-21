import { useState, useCallback } from 'react';

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

async function reverseGeocode(lat, lng) {
    try {
        const params = new URLSearchParams({ lat, lon: lng, format: 'json', zoom: '16' });
        const res = await fetch(`${NOMINATIM_REVERSE}?${params}`, {
            headers: { 'User-Agent': 'SafeMaps Vancouver/1.0' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.display_name) return null;
        // Build a short readable label: street number + street, or fall back to display_name
        const addr = data.address || {};
        const parts = [
            addr.house_number,
            addr.road || addr.pedestrian || addr.path,
            addr.suburb || addr.neighbourhood || addr.city_district,
        ].filter(Boolean);
        return parts.length >= 2 ? parts.join(' ') : data.display_name.split(',').slice(0, 2).join(',').trim();
    } catch {
        return null;
    }
}

export function useCurrentLocation() {
    const [locating, setLocating] = useState(false);
    const [locationError, setLocationError] = useState(null);

    const getLocation = useCallback(async () => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser.');
            return null;
        }

        setLocating(true);
        setLocationError(null);

        return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;

                    // Try to get a human-readable address via Nominatim reverse geocoding
                    const address = await reverseGeocode(lat, lng);
                    const label = address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

                    setLocating(false);
                    resolve({ lat, lng, label });
                },
                (err) => {
                    setLocating(false);
                    if (err.code === err.PERMISSION_DENIED) {
                        setLocationError('Location access denied. Allow it in your browser settings.');
                    } else if (err.code === err.POSITION_UNAVAILABLE) {
                        setLocationError('Location unavailable. Try clicking the map instead.');
                    } else {
                        setLocationError('Could not get your location. Try again.');
                    }
                    resolve(null);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }, []);

    return { getLocation, locating, locationError };
}
