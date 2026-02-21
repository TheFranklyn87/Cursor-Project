import { useState, useEffect } from 'react';
import { SearchForm } from './components/SearchForm';
import { RouteCard } from './components/RouteCard';
import { MapView } from './components/MapView';
import { useRoute } from './hooks/useRoute';
import './App.css';

function App() {
  const { routes, loading, error, from, to, fetchRoutes, clear } = useRoute();
  const [routeMode, setRouteMode] = useState('safest');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [clickMode, setClickMode] = useState(null);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');

  useEffect(() => {
    if (routes?.routes?.length) setSelectedIndex(0);
  }, [routes, routeMode]);

  const handleSearch = (fromCoord, toCoord, night) => {
    setRouteMode('safest');
    fetchRoutes(fromCoord, toCoord, night);
  };

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
        />
        {error && <div className="error">{error}</div>}
        {routes?.routes && optionIndicesSafe.length > 0 && (
          <div className="route-list">
            <div className="route-list-header">
              <h3>{routeMode === 'safest' ? 'Safest routes' : 'Fastest routes'}</h3>
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
          <button className="clear-btn" onClick={clear}>
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
