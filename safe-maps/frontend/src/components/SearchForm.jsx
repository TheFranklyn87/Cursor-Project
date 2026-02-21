import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const COORD_REGEX = /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/;

const PRESETS = [
  { id: 'gastown-yaletown', label: 'Gastown → Yaletown', from: { lat: 49.2834, lng: -123.1118 }, to: { lat: 49.2745, lng: -123.1216 } },
  { id: 'downtown-strathcona', label: 'Downtown → Strathcona', from: { lat: 49.2824, lng: -123.1206 }, to: { lat: 49.2776, lng: -123.099 } },
  { id: 'hastings-mountpleasant', label: 'East Hastings → Mount Pleasant', from: { lat: 49.2827, lng: -123.1045 }, to: { lat: 49.2722, lng: -123.1048 } },
];

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
  const [night, setNight] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const fromValue = fromText ?? '';
  const toValue = toText ?? '';

  const handlePreset = (preset) => {
    setValidationError(null);
    onSearch(preset.from, preset.to, night);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError(null);
    const fromMatch = fromValue.trim().match(COORD_REGEX);
    const toMatch = toValue.trim().match(COORD_REGEX);
    if (fromMatch && toMatch) {
      onSearch(
        { lat: parseFloat(fromMatch[1]), lng: parseFloat(fromMatch[2]) },
        { lat: parseFloat(toMatch[1]), lng: parseFloat(toMatch[2]) },
        night
      );
      return;
    }
    if (!fromValue.trim() || !toValue.trim()) {
      setValidationError('Enter coordinates (e.g. 49.28, -123.12), an address, or use a preset.');
      return;
    }
    setIsGeocoding(true);
    try {
      const [fromRes, toRes] = await Promise.all([
        fetch(`${API_BASE}/geocode?q=${encodeURIComponent(fromValue.trim())}`).then((r) => r.json()),
        fetch(`${API_BASE}/geocode?q=${encodeURIComponent(toValue.trim())}`).then((r) => r.json()),
      ]);
      if (fromRes.error || !fromRes.lat) {
        setValidationError('Could not find origin. Try coordinates or a preset.');
        return;
      }
      if (toRes.error || !toRes.lat) {
        setValidationError('Could not find destination. Try coordinates or a preset.');
        return;
      }
      onSearch(
        { lat: fromRes.lat, lng: fromRes.lng },
        { lat: toRes.lat, lng: toRes.lng },
        night
      );
    } catch (err) {
      setValidationError('Address lookup failed. Try coordinates or a preset.');
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div className="search-form">
      <h2>Safe Maps</h2>
      <p className="tagline">Find the safest walking route in Vancouver</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>From (address or lat, lng)</label>
          <div className="input-with-action">
            <input
              type="text"
              placeholder="e.g. Gastown Vancouver or 49.2834, -123.1118"
              value={fromValue}
              onChange={(e) => setFromText(e.target.value)}
            />
            <button
              type="button"
              className={`map-click-btn ${clickMode === 'from' ? 'active' : ''}`}
              onClick={() => setClickMode(clickMode === 'from' ? null : 'from')}
              title="Click on map to set"
            >
              Map
            </button>
          </div>
        </div>
        <div className="form-group">
          <label>To (address or lat, lng)</label>
          <div className="input-with-action">
            <input
              type="text"
              placeholder="e.g. Yaletown Vancouver or 49.2745, -123.1216"
              value={toValue}
              onChange={(e) => setToText(e.target.value)}
            />
            <button
              type="button"
              className={`map-click-btn ${clickMode === 'to' ? 'active' : ''}`}
              onClick={() => setClickMode(clickMode === 'to' ? null : 'to')}
              title="Click on map to set"
            >
              Map
            </button>
          </div>
        </div>
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
          {loading ? 'Finding routes...' : isGeocoding ? 'Resolving addresses...' : 'Find safest route'}
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
