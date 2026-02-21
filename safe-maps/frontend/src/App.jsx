import { useState, useEffect, useCallback } from 'react';
import { SearchForm } from './components/SearchForm';
import { RouteCard } from './components/RouteCard';
import { MapView } from './components/MapView';
import { ShareButton } from './components/ShareButton';
import { useRoute } from './hooks/useRoute';
import { useTheme } from './hooks/useTheme';
import './App.css';

// Parse ?from=lat,lng&to=lat,lng&night=1&fl=label&tl=label from URL
function readUrlParams() {
  const p = new URLSearchParams(window.location.search);
  const fromStr = p.get('from');
  const toStr = p.get('to');
  if (!fromStr || !toStr) return null;
  const [fLat, fLng] = fromStr.split(',').map(Number);
  const [tLat, tLng] = toStr.split(',').map(Number);
  if ([fLat, fLng, tLat, tLng].some(isNaN)) return null;
  return {
    from: { lat: fLat, lng: fLng, label: p.get('fl') || `${fLat}, ${fLng}` },
    to:   { lat: tLat, lng: tLng, label: p.get('tl') || `${tLat}, ${tLng}` },
    night: p.get('night') === '1',
  };
}

function writeUrlParams(from, to, night, fromText, toText) {
  const p = new URLSearchParams();
  p.set('from', `${from.lat},${from.lng}`);
  p.set('to',   `${to.lat},${to.lng}`);
  if (night) p.set('night', '1');
  if (fromText) p.set('fl', fromText);
  if (toText)   p.set('tl', toText);
  const newUrl = `${window.location.pathname}?${p.toString()}`;
  window.history.replaceState(null, '', newUrl);
}

function clearUrlParams() {
  window.history.replaceState(null, '', window.location.pathname);
}

function App() {
  const { routes, loading, error, from, to, fetchRoutes, clear } = useRoute();
  const { theme, toggleTheme } = useTheme();
  const [routeMode, setRouteMode] = useState('safest');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [clickMode, setClickMode] = useState(null);

  // Pre-fill from URL on first load
  const initialParams = readUrlParams();
  const [fromText, setFromText] = useState(initialParams?.from?.label ?? '');
  const [toText,   setToText]   = useState(initialParams?.to?.label   ?? '');

  // Auto-search if URL has valid params
  useEffect(() => {
    const params = readUrlParams();
    if (params) {
      fetchRoutes(params.from, params.to, params.night);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (routes?.routes?.length) setSelectedIndex(0);
  }, [routes, routeMode]);

  const handleSearch = useCallback((fromCoord, toCoord, night) => {
    setRouteMode('safest');
    writeUrlParams(fromCoord, toCoord, night, fromText, toText);
    fetchRoutes(fromCoord, toCoord, night);
  }, [fetchRoutes, fromText, toText]);

  const handleClear = useCallback(() => {
    clearUrlParams();
    clear();
  }, [clear]);

  const handleModeChange = (mode) => {
    setRouteMode(mode);
    setSelectedIndex(0);
  };

  const optionIndices = (routeMode === 'safest' ? routes?.safestOptions : routes?.fastestOptions) ?? [];
  const optionIndicesSafe = optionIndices.length ? optionIndices : (routes?.routes?.length ? [0] : []);
  const actualRouteIndex = optionIndicesSafe[Math.min(selectedIndex, optionIndicesSafe.length - 1)] ?? 0;

  const handleMapClick = (lat, lng) => {
    if (!clickMode) return;
    if (clickMode === 'from') setFromText(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    else setToText(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    setClickMode(null);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <SearchForm
          onSearch={handleSearch}
          loading={loading}
          fromText={fromText}
          setFromText={setFromText}
          toText={toText}
          setToText={setToText}
          clickMode={clickMode}
          setClickMode={setClickMode}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        {error && <div className="error">{error}</div>}
        {routes?.routes && optionIndicesSafe.length > 0 && (
          <div className="route-list">
            <div className="route-list-header">
              <h3>{routeMode === 'safest' ? 'Safest routes' : 'Fastest routes'}</h3>
              <div className="route-list-header-right">
                <ShareButton />
                <div className="route-mode-switcher" role="tablist" aria-label="Route preference">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={routeMode === 'safest'}
                    className={routeMode === 'safest' ? 'active' : ''}
                    onClick={() => handleModeChange('safest')}
                  >
                    Safest
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={routeMode === 'fastest'}
                    className={routeMode === 'fastest' ? 'active' : ''}
                    onClick={() => handleModeChange('fastest')}
                  >
                    Fastest
                  </button>
                </div>
              </div>
            </div>
            <p className="route-mode-hint">
              {routeMode === 'safest' ? 'Safest first — may be longer.' : 'Fastest first — shortest time.'}
            </p>
            {optionIndicesSafe.map((routeIdx, listPosition) => {
              const route = routes.routes[routeIdx];
              if (!route) return null;
              return (
                <RouteCard
                  key={routeIdx}
                  route={route}
                  routeIdx={routeIdx}
                  listPosition={listPosition}
                  routeMode={routeMode}
                  isSafest={routeIdx === routes.recommended}
                  isFastest={routeIdx === routes.fastest}
                  isRecommended={listPosition === 0}
                  isSelected={selectedIndex === listPosition}
                  onSelect={setSelectedIndex}
                />
              );
            })}
          </div>
        )}
        {routes && (
          <button className="clear-btn" onClick={handleClear}>
            Clear
          </button>
        )}
      </aside>
      <main className="main">
        <MapView
          routes={routes}
          selectedIndex={actualRouteIndex}
          from={from}
          to={to}
          clickMode={clickMode}
          onMapClick={handleMapClick}
        />
      </main>
    </div>
  );
}

export default App;
