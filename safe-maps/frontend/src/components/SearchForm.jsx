import { useState, useCallback, useRef, useEffect } from 'react';
import { useRoute } from '../hooks/useRoute';

const PRESETS = [
    { id: 'gastown-yaletown', label: 'Gastown → Yaletown', from: { lat: 49.2834, lng: -123.1118 }, to: { lat: 49.2745, lng: -123.1216 } },
    { id: 'downtown-strathcona', label: 'Downtown → Strathcona', from: { lat: 49.2824, lng: -123.1206 }, to: { lat: 49.2776, lng: -123.099 } },
    { id: 'hastings-mountpleasant', label: 'East Hastings → Mount Pleasant', from: { lat: 49.2827, lng: -123.1045 }, to: { lat: 49.2722, lng: -123.1048 } },
];

function AutocompleteInput({ label, value, onChange, placeholder, geocode, onSelect }) {
    const [suggestions, setSuggestions] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const debounceTimer = useRef(null);

    const fetchSuggestions = useCallback(async (text) => {
        if (text.length < 3) {
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
        onChange(item.display_name);
        onSelect({ lat: item.lat, lng: item.lng });
        setSuggestions([]);
        setShowDropdown(false);
    };

    return (
        <div className="form-group autocomplete">
            <label>{label}</label>
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={handleInputChange}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            />
            {showDropdown && (
                <ul className="suggestions-dropdown">
                    {suggestions.map((item, idx) => (
                        <li key={idx} onClick={() => handleSelect(item)}>
                            {item.display_name}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function SearchForm({ onSearch, loading }) {
    const { geocode } = useRoute();
    const [night, setNight] = useState(false);
    const [fromText, setFromText] = useState('');
    const [toText, setToText] = useState('');
    const [fromCoord, setFromCoord] = useState(null);
    const [toCoord, setToCoord] = useState(null);

    const handlePreset = (preset) => {
        setFromText(preset.label.split(' → ')[0]);
        setToText(preset.label.split(' → ')[1]);
        setFromCoord(preset.from);
        setToCoord(preset.to);
        onSearch(preset.from, preset.to, night);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (fromCoord && toCoord) {
            onSearch(fromCoord, toCoord, night);
        } else {
            // Fallback for direct coordinate input if user just pastes lat,lng
            const fromMatch = fromText.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
            const toMatch = toText.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
            if (fromMatch && toMatch) {
                onSearch(
                    { lat: parseFloat(fromMatch[1]), lng: parseFloat(fromMatch[2]) },
                    { lat: parseFloat(toMatch[1]), lng: parseFloat(toMatch[2]) },
                    night
                );
            }
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
                />
                <AutocompleteInput
                    label="To"
                    placeholder="Destination address or area"
                    value={toText}
                    onChange={setToText}
                    geocode={geocode}
                    onSelect={setToCoord}
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
                <button type="submit" disabled={loading || !fromCoord || !toCoord}>
                    {loading ? 'Finding routes...' : 'Find safest route'}
                </button>
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

