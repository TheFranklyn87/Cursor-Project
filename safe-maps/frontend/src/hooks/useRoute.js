import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function useRoute() {
    const [routes, setRoutes] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [from, setFrom] = useState(null);
    const [to, setTo] = useState(null);

    const geocode = useCallback(async (query) => {
        if (!query || query.length < 3) return [];
        try {
            const res = await fetch(`${API_BASE}/geocode?q=${encodeURIComponent(query)}`);
            if (!res.ok) return [];
            return await res.json();
        } catch (err) {
            console.error('Geocoding error:', err);
            return [];
        }
    }, []);

    const fetchRoutes = useCallback(async (fromCoord, toCoord, night = false) => {

        setLoading(true);
        setError(null);
        setRoutes(null);
        setFrom(fromCoord);
        setTo(toCoord);

        try {
            const fromStr = `${fromCoord.lat},${fromCoord.lng}`;
            const toStr = `${toCoord.lat},${toCoord.lng}`;
            const res = await fetch(
                `${API_BASE}/route?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&night=${night}`
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Route request failed');
            setRoutes(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const clear = useCallback(() => {
        setRoutes(null);
        setError(null);
        setFrom(null);
        setTo(null);
    }, []);

    return { routes, loading, error, from, to, fetchRoutes, geocode, clear };
}
