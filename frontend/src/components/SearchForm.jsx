import { useState, useCallback, useRef, useEffect } from 'react';
import { useRoute } from '../hooks/useRoute';
import { useRecentSearches, useSavedPlaces } from '../hooks/useStorage';
import { useCurrentLocation } from '../hooks/useCurrentLocation';

const COORD_REGEX = /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/;

const PRESETS = [
    { id: 'gastown-yaletown', label: 'Gastown → Yaletown', from: { lat: 49.2834, lng: -123.1118 }, to: { lat: 49.2745, lng: -123.1216 } },
    { id: 'downtown-strathcona', label: 'Downtown → Strathcona', from: { lat: 49.2824, lng: -123.1206 }, to: { lat: 49.2776, lng: -123.099 } },
    { id: 'hastings-mountpleasant', label: 'East Hastings → Mount Pleasant', from: { lat: 49.2827, lng: -123.1045 }, to: { lat: 49.2722, lng: -123.1048 } },
];

function AutocompleteInput({ label, value, onChange, placeholder, geocode, onSelect, actionButton, onFocus }) {
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
        const label = item.displayName || item.display_name;
        onChange(label);
        onSelect({ lat: item.lat, lng: item.lng, label });
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
                    onFocus={() => {
                        if (onFocus) onFocus();
                        if (suggestions.length > 0) setShowDropdown(true);
                    }}
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

function isNightTime() {
    const h = new Date().getHours();
    return h >= 20 || h < 6;
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
    theme,
    onToggleTheme,
    isMobileExpanded,
    setIsMobileExpanded
}) {
    const { geocode } = useRoute();
    const { recent, addRecent, clearRecent } = useRecentSearches();
    const { places, addPlace, removePlace } = useSavedPlaces();
    const { getLocation, locating, locationError } = useCurrentLocation();
    const [nightAutoDetected] = useState(isNightTime);
    const [night, setNight] = useState(isNightTime);
    const [fromCoord, setFromCoord] = useState(null);
    const [toCoord, setToCoord] = useState(null);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const [validationError, setValidationError] = useState(null);

    const handleUseCurrentLocation = async () => {
        setValidationError(null);
        const result = await getLocation(geocode);
        if (result) {
            setFromText(result.label);
            setFromCoord(result);
        }
    };

    // Reset coords if text changes significantly (and isn't a coordinate)
    useEffect(() => {
        if (fromText && !COORD_REGEX.test(fromText) && fromCoord && fromText !== fromCoord.label) {
            setFromCoord(null);
        }
    }, [fromText, fromCoord]);

    useEffect(() => {
        if (toText && !COORD_REGEX.test(toText) && toCoord && toText !== toCoord.label) {
            setToCoord(null);
        }
    }, [toText, toCoord]);

    const handlePreset = (preset) => {
        setValidationError(null);
        const fromLabel = preset.label.split(' → ')[0];
        const toLabel = preset.label.split(' → ')[1];
        setFromText(fromLabel);
        setToText(toLabel);
        setFromCoord({ ...preset.from, label: fromLabel });
        setToCoord({ ...preset.to, label: toLabel });
        addRecent({ fromLabel, toLabel, from: preset.from, to: preset.to, night });
        onSearch(preset.from, preset.to, night);
    };

    const handleRecentClick = (item) => {
        setValidationError(null);
        setFromText(item.fromLabel || `${item.from.lat.toFixed(4)}, ${item.from.lng.toFixed(4)}`);
        setToText(item.toLabel || `${item.to.lat.toFixed(4)}, ${item.to.lng.toFixed(4)}`);
        setFromCoord({ ...item.from, label: item.fromLabel });
        setToCoord({ ...item.to, label: item.toLabel });
        setNight(item.night ?? false);
        onSearch(item.from, item.to, item.night ?? false);
    };

    const setSavedAsFrom = (place) => {
        setFromText(place.label);
        setFromCoord({ lat: place.lat, lng: place.lng, label: place.label });
    };

    const setSavedAsTo = (place) => {
        setToText(place.label);
        setToCoord({ lat: place.lat, lng: place.lng, label: place.label });
    };

    const handleSaveFromAsPlace = () => {
        if (!fromCoord) return;
        const label = window.prompt('Name this place', fromText || 'Home');
        if (label?.trim()) addPlace({ label: label.trim(), lat: fromCoord.lat, lng: fromCoord.lng });
    };

    const handleSaveToAsPlace = () => {
        if (!toCoord) return;
        const label = window.prompt('Name this place', toText || 'Work');
        if (label?.trim()) addPlace({ label: label.trim(), lat: toCoord.lat, lng: toCoord.lng });
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
            const fromLabel = fromText?.trim() || `${finalFrom.lat.toFixed(4)}, ${finalFrom.lng.toFixed(4)}`;
            const toLabel = toText?.trim() || `${finalTo.lat.toFixed(4)}, ${finalTo.lng.toFixed(4)}`;
            addRecent({ fromLabel, toLabel, from: finalFrom, to: finalTo, night });
            onSearch(finalFrom, finalTo, night);
        } else {
            setValidationError('Please select locations from the dropdown, enter coordinates, or click the map.');
        }
    };

    return (
        <div className={`search-form ${isMobileExpanded ? 'expanded-mobile-mode' : ''}`}>
            {isMobileExpanded && (
                <div className="mobile-search-header">
                    <button type="button" className="close-search-btn" onClick={() => setIsMobileExpanded(false)}>
                        ✕ Close Search
                    </button>
                    <button
                        type="button"
                        className="theme-toggle"
                        onClick={onToggleTheme}
                        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                </div>
            )}

            {!isMobileExpanded && (
                <>
                    <div className="sidebar-header">
                        <h2>Safe Maps</h2>
                        <button
                            type="button"
                            className="theme-toggle"
                            onClick={onToggleTheme}
                            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? '☀️' : '🌙'}
                        </button>
                    </div>
                    <p className="tagline">Find the safest walking route in Vancouver</p>
                </>
            )}

            <form onSubmit={handleSubmit}>
                <AutocompleteInput
                    label="From"
                    placeholder="Start address or area"
                    value={fromText}
                    onChange={setFromText}
                    geocode={geocode}
                    onSelect={setFromCoord}
                    actionButton={
                        <div className="input-actions">
                            <button
                                type="button"
                                className={`locate-btn ${locating ? 'locating' : ''}`}
                                onClick={handleUseCurrentLocation}
                                disabled={locating}
                                title="Use my current location"
                                aria-label="Use current location"
                            >
                                {locating ? '…' : '⊕'}
                            </button>
                            {fromCoord && (
                                <button type="button" className="save-place-btn" onClick={handleSaveFromAsPlace} title="Save as place">
                                    ★
                                </button>
                            )}
                            <button
                                type="button"
                                className={`map-click-btn ${clickMode === 'from' ? 'active' : ''}`}
                                onClick={() => {
                                    setClickMode(clickMode === 'from' ? null : 'from');
                                    setIsMobileExpanded && setIsMobileExpanded(false);
                                }}
                                title="Click on map to set"
                            >
                                Map
                            </button>
                        </div>
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
                        <div className="input-actions">
                            {toCoord && (
                                <button type="button" className="save-place-btn" onClick={handleSaveToAsPlace} title="Save as place">
                                    ★
                                </button>
                            )}
                            <button
                                type="button"
                                className={`map-click-btn ${clickMode === 'to' ? 'active' : ''}`}
                                onClick={() => {
                                    setClickMode(clickMode === 'to' ? null : 'to');
                                    setIsMobileExpanded && setIsMobileExpanded(false);
                                }}
                                title="Click on map to set"
                            >
                                Map
                            </button>
                        </div>
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
                        {nightAutoDetected && (
                            <span className="night-auto-hint">auto-detected</span>
                        )}
                    </label>
                </div>
                <button type="submit" disabled={loading || isGeocoding}>
                    {loading ? 'Finding routes...' : isGeocoding ? 'Resolving...' : 'Find safest route'}
                </button>
                {validationError && (
                    <p className="validation-error" role="alert">{validationError}</p>
                )}
                {locationError && (
                    <p className="validation-error" role="alert">{locationError}</p>
                )}
            </form>

            {places.length > 0 && (
                <div className="saved-places section">
                    <p className="section-title">Saved places</p>
                    <ul className="saved-places-list">
                        {places.map((place) => (
                            <li key={place.id} className="saved-place-item">
                                <span className="saved-place-label">{place.label}</span>
                                <div className="saved-place-actions">
                                    <button type="button" className="saved-place-btn" onClick={() => setSavedAsFrom(place)}>From</button>
                                    <button type="button" className="saved-place-btn" onClick={() => setSavedAsTo(place)}>To</button>
                                    <button type="button" className="saved-place-remove" onClick={() => removePlace(place.id)} title="Remove" aria-label="Remove place">×</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {recent.length > 0 && (
                <div className="recent-searches section">
                    <p className="section-title">
                        Recent
                        <button type="button" className="clear-recent-btn" onClick={clearRecent}>Clear</button>
                    </p>
                    {recent.map((item, idx) => (
                        <button
                            key={item.id ?? idx}
                            type="button"
                            className="preset-btn recent-btn"
                            onClick={() => handleRecentClick(item)}
                            disabled={loading}
                        >
                            {item.fromLabel} → {item.toLabel}
                        </button>
                    ))}
                </div>
            )}

            {isMobileExpanded && (
                <div className="presets section">
                    <p className="section-title">Quick demo:</p>
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
            )}

            {!isMobileExpanded && (
                <div className="presets section">
                    <p className="section-title">Quick demo:</p>
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
            )}
        </div>
    );
}
