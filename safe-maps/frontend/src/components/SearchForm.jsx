import { useState, useCallback, useRef, useEffect } from 'react';
import { useRoute } from '../hooks/useRoute';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const COORD_REGEX = /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/;

const PRESETS = [
    { id: 'gastown-yaletown', label: 'Gastown → Yaletown', from: { lat: 49.2834, lng: -123.1118 }, to: { lat: 49.2745, lng: -123.1216 } },
    { id: 'downtown-strathcona', label: 'Downtown → Strathcona', from: { lat: 49.2824, lng: -123.1206 }, to: { lat: 49.2776, lng: -123.099 } },
    { id: 'hastings-mountpleasant', label: 'East Hastings → Mount Pleasant', from: { lat: 49.2827, lng: -123.1045 }, to: { lat: 49.2722, lng: -123.1048 } },
];

function AutocompleteInput({ label, value, onChange, placeholder, geocode, onSelect, actionButton }) {
    const [suggestions, setSuggestions] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const debounceTimer = useRef(null);

    const fetchSuggestions = useCallback(async (text) => {
        if (text.length < 3 || COORD_REGEX.test(text)) {
            setSuggestions([]);
            return;
        }
        const results = await geocode(text);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
    }, [geocode]);

    const handleInputChange = (e) => {
        const text = e.target.value;
        onChange(text);

        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            fetchSuggestions(text);
        }, 300);
    };

    const handleSelect = (item) => {
        onChange(item.displayName || item.display_name);
        onSelect({ lat: item.lat, lng: item.lng });
        setSuggestions([]);
        setShowDropdown(false);
    };

    return (
        <div className="form-group autocomplete">
            <label>{label}</label>
            <div className="input-with-action">
                <input
                    type="text"
                    placeholder={placeholder}
                    value={value}
                    onChange={handleInputChange}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                />
                {actionButton}
            </div>
            {showDropdown && (
                <ul className="suggestions-dropdown">
                    {suggestions.map((item, idx) => (
                        <li key={idx} onClick={() => handleSelect(item)}>
                            {item.displayName || item.display_name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function SearchForm({
    onSearch,
    loading,
    fromText,
    setFromText,
    toText,
    setToText,
    clickMode,
    setClickMode,
}) {
    const { geocode } = useRoute();
    const [night, setNight] = useState(false);
    const [fromCoord, setFromCoord] = useState(null);
    const [toCoord, setToCoord] = useState(null);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [validationError, setValidationError] = useState(null);

    // Reset coords if text changes significantly (and isn't a coordinate)
    useEffect(() => {
        if (fromText && !COORD_REGEX.test(fromText) && fromCoord && fromText !== fromCoord.label) {
            setFromCoord(null);
        }
    }, [fromText]);

    useEffect(() => {
        if (toText && !COORD_REGEX.test(toText) && toCoord && toText !== toCoord.label) {
            setToCoord(null);
        }
    }, [toText]);

    const handlePreset = (preset) => {
        setValidationError(null);
        setFromText(preset.label.split(' → ')[0]);
        setToText(preset.label.split(' → ')[1]);
        setFromCoord(preset.from);
        setToCoord(preset.to);
        onSearch(preset.from, preset.to, night);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setValidationError(null);

        let finalFrom = fromCoord;
        let finalTo = toCoord;

        // Fallback for direct coordinate input
        const fromMatch = fromText.match(COORD_REGEX);
        const toMatch = toText.match(COORD_REGEX);

        if (fromMatch) finalFrom = { lat: parseFloat(fromMatch[1]), lng: parseFloat(fromMatch[2]) };
        if (toMatch) finalTo = { lat: parseFloat(toMatch[1]), lng: parseFloat(toMatch[2]) };

        // If still no coords, attempt manual geocoding for whatever is in the box
        if (!finalFrom || !finalTo) {
            setIsGeocoding(true);
            try {
                if (!finalFrom && fromText.length >= 3) {
                    const res = await geocode(fromText);
                    if (res && res.length > 0) finalFrom = { lat: res[0].lat, lng: res[0].lng };
                }
                if (!finalTo && toText.length >= 3) {
                    const res = await geocode(toText);
                    if (res && res.length > 0) finalTo = { lat: res[0].lat, lng: res[0].lng };
                }
            } catch (err) {
                console.error('Final geocode attempt failed', err);
            } finally {
                setIsGeocoding(false);
            }
        }

        if (finalFrom && finalTo) {
            onSearch(finalFrom, finalTo, night);
        } else {
            setValidationError('Please select locations from the dropdown, enter coordinates, or click the map.');
        }
    };

    return (
        <div className="search-form">
            <h2>Safe Maps</h2>
            <p className="tagline">Find the safest walking route in Vancouver</p>

            <form onSubmit={handleSubmit}>
                <AutocompleteInput
                    label="From"
                    placeholder="Start address or area"
                    value={fromText}
                    onChange={setFromText}
                    geocode={geocode}
                    onSelect={setFromCoord}
                    actionButton={
                        <button
                            type="button"
                            className={`map-click-btn ${clickMode === 'from' ? 'active' : ''}`}
                            onClick={() => setClickMode(clickMode === 'from' ? null : 'from')}
                            title="Click on map to set"
                        >
                            Map
                        </button>
                    }
                />
                <AutocompleteInput
                    label="To"
                    placeholder="Destination address or area"
                    value={toText}
                    onChange={setToText}
                    geocode={geocode}
                    onSelect={setToCoord}
                    actionButton={
                        <button
                            type="button"
                            className={`map-click-btn ${clickMode === 'to' ? 'active' : ''}`}
                            onClick={() => setClickMode(clickMode === 'to' ? null : 'to')}
                            title="Click on map to set"
                        >
                            Map
                        </button>
                    }
                />
                <div className="form-group checkbox">
                    <label>
                        <input
                            type="checkbox"
                            checked={night}
                            onChange={(e) => setNight(e.target.checked)}
                        />
                        Walking at night (prioritize lit routes)
                    </label>
                </div>
                <button type="submit" disabled={loading || isGeocoding}>
                    {loading ? 'Finding routes...' : isGeocoding ? 'Resolving...' : 'Find safest route'}
                </button>
                {validationError && (
                    <p className="validation-error" role="alert">{validationError}</p>
                )}
            </form>

            <div className="presets">
                <p>Quick demo:</p>
                {PRESETS.map((preset) => (
                    <button
                        key={preset.id}
                        type="button"
                        className="preset-btn"
                        onClick={() => handlePreset(preset)}
                        disabled={loading}
                    >
                        {preset.label}
                    </button>
                ))}
            </div>
        </div>
    );
}


