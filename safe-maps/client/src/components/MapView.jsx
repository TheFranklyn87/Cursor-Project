import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

import 'leaflet/dist/leaflet.css';

const VANCOUVER_CENTER = [49.28, -123.12];
const SAFE_COLOR = '#22c55e';
const NORMAL_COLOR = '#6b7280';

function MapUpdater({ routes, from, to }) {
  const map = useMap();

  useEffect(() => {
    if (routes?.routes?.length) {
      const allCoords = routes.routes.flatMap((r) =>
        r.geometry?.coordinates?.map((c) => [c[1], c[0]]) || []
      );
      if (allCoords.length) {
        map.fitBounds(allCoords, { padding: [40, 40] });
      }
    } else if (from && to) {
      map.fitBounds([[from.lat, from.lng], [to.lat, to.lng]], { padding: [60, 60] });
    }
  }, [routes, from, to, map]);

  return null;
}

function RoutePolylines({ routes, selectedIndex }) {
  if (!routes?.routes) return null;

  return routes.routes.map((route, i) => {
    const coords = route.geometry?.coordinates?.map((c) => [c[1], c[0]]) || [];
    const isRecommended = i === routes.recommended;
    const isSelected = selectedIndex === i;
    const isHighlight = isRecommended || isSelected;
    const color = isHighlight ? SAFE_COLOR : NORMAL_COLOR;
    const weight = isHighlight ? 5 : 3;
    const opacity = isSelected ? 1 : isHighlight ? 0.9 : 0.5;

    return (
      <Polyline
        key={i}
        positions={coords}
        pathOptions={{ color, weight, opacity }}
      />
    );
  });
}

const pinIcon = L.divIcon({
  className: 'marker-pin',
  html: '<div class="pin-inner"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

const pinIconTo = L.divIcon({
  className: 'marker-pin marker-pin-to',
  html: '<div class="pin-inner"></div>',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

export function MapView({ routes, selectedIndex, from, to }) {
  return (
    <div className="map-container">
      <MapContainer
        center={VANCOUVER_CENTER}
        zoom={14}
        className="map"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdater routes={routes} from={from} to={to} />
        <RoutePolylines routes={routes} selectedIndex={selectedIndex} />
        {from && <Marker position={[from.lat, from.lng]} icon={pinIcon} />}
        {to && <Marker position={[to.lat, to.lng]} icon={pinIconTo} />}
      </MapContainer>
      <div className="map-legend">
        <span><strong>Green</strong> = Safest route</span>
        <span><strong>Gray</strong> = Other options</span>
      </div>
    </div>
  );
}
