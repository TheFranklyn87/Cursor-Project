import { useState } from 'react';
import { SearchForm } from './components/SearchForm';
import { RouteCard } from './components/RouteCard';
import { MapView } from './components/MapView';
import { useRoute } from './hooks/useRoute';
import './App.css';

function App() {
  const { routes, loading, error, from, to, fetchRoutes, clear } = useRoute();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [clickMode, setClickMode] = useState(null);
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');

  const handleSearch = (fromCoord, toCoord, night) => {
    setSelectedIndex(0);
    fetchRoutes(fromCoord, toCoord, night);
  };

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
        {routes?.routes && (
          <div className="route-list">
            <h3>Routes</h3>
            {routes.routes.map((route, i) => (
              <RouteCard
                key={i}
                route={route}
                index={i}
                isRecommended={i === routes.recommended}
                isSelected={selectedIndex === i}
                onSelect={setSelectedIndex}
              />
            ))}
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
          selectedIndex={selectedIndex}
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
