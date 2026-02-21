import { useState } from 'react';

const PRESETS = [
  { id: 'gastown-yaletown', label: 'Gastown → Yaletown', from: { lat: 49.2834, lng: -123.1118 }, to: { lat: 49.2745, lng: -123.1216 } },
  { id: 'downtown-strathcona', label: 'Downtown → Strathcona', from: { lat: 49.2824, lng: -123.1206 }, to: { lat: 49.2776, lng: -123.099 } },
  { id: 'hastings-mountpleasant', label: 'East Hastings → Mount Pleasant', from: { lat: 49.2827, lng: -123.1045 }, to: { lat: 49.2722, lng: -123.1048 } },
];

export function SearchForm({ onSearch, loading }) {
  const [night, setNight] = useState(false);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');

  const handlePreset = (preset) => {
    onSearch(preset.from, preset.to, night);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const fromMatch = fromText.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    const toMatch = toText.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
    if (fromMatch && toMatch) {
      onSearch(
        { lat: parseFloat(fromMatch[1]), lng: parseFloat(fromMatch[2]) },
        { lat: parseFloat(toMatch[1]), lng: parseFloat(toMatch[2]) },
        night
      );
    } else {
      const preset = PRESETS[0];
      onSearch(preset.from, preset.to, night);
    }
  };

  return (
    <div className="search-form">
      <h2>Safe Maps</h2>
      <p className="tagline">Find the safest walking route in Vancouver</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>From (lat, lng)</label>
          <input
            type="text"
            placeholder="e.g. 49.2834, -123.1118"
            value={fromText}
            onChange={(e) => setFromText(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>To (lat, lng)</label>
          <input
            type="text"
            placeholder="e.g. 49.2745, -123.1216"
            value={toText}
            onChange={(e) => setToText(e.target.value)}
          />
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
        <button type="submit" disabled={loading}>
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
