import { useState } from 'react';
import { SearchForm } from './components/SearchForm';
import { RouteCard } from './components/RouteCard';
import { MapView } from './components/MapView';
import { useRoute } from './hooks/useRoute';
import './App.css';

function App() {
  const { routes, loading, error, from, to, fetchRoutes, clear } = useRoute();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleSearch = (fromCoord, toCoord, night) => {
    setSelectedIndex(0);
    fetchRoutes(fromCoord, toCoord, night);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <SearchForm onSearch={handleSearch} loading={loading} />
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
        />
      </main>
    </div>
  );
}

export default App;
