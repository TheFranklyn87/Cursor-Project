import { useState, useCallback, useEffect } from 'react';

const RECENT_KEY = 'safemaps_recent';
const SAVED_PLACES_KEY = 'safemaps_places';
const MAX_RECENT = 5;

function loadJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function saveJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn('localStorage save failed', e);
    }
}

function recentKey(from, to) {
    return `${from?.lat?.toFixed(4)}_${from?.lng?.toFixed(4)}_${to?.lat?.toFixed(4)}_${to?.lng?.toFixed(4)}`;
}

export function useRecentSearches() {
    const [recent, setRecent] = useState(() => loadJson(RECENT_KEY, []));

    const addRecent = useCallback((item) => {
        if (!item?.from || !item?.to) return;
        const key = recentKey(item.from, item.to);
        setRecent((prev) => {
            const next = [
                { ...item, id: key },
                ...prev.filter((r) => recentKey(r.from, r.to) !== key),
            ].slice(0, MAX_RECENT);
            saveJson(RECENT_KEY, next);
            return next;
        });
    }, []);

    const clearRecent = useCallback(() => {
        setRecent([]);
        saveJson(RECENT_KEY, []);
    }, []);

    return { recent, addRecent, clearRecent };
}

export function useSavedPlaces() {
    const [places, setPlaces] = useState(() => loadJson(SAVED_PLACES_KEY, []));

    useEffect(() => {
        saveJson(SAVED_PLACES_KEY, places);
    }, [places]);

    const addPlace = useCallback(({ label, lat, lng }) => {
        const id = `place_${Date.now()}`;
        setPlaces((prev) => [...prev, { id, label: label || 'Saved place', lat, lng }]);
        return id;
    }, []);

    const removePlace = useCallback((id) => {
        setPlaces((prev) => prev.filter((p) => p.id !== id));
    }, []);

    return { places, addPlace, removePlace };
}
