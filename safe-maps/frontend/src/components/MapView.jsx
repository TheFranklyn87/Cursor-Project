import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap, useMapEvents, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

import 'leaflet/dist/leaflet.css';

const VANCOUVER_CENTER = [49.28, -123.12];
const SAFE_COLOR = '#22c55e'; // Green
const MODERATE_COLOR = '#eab308'; // Yellow
const DANGER_COLOR = '#ef4444'; // Red
const UNSELECTED_PALETTE = ['#3b82f6', '#a855f7', '#fb923c', '#94a3b8']; // Blue, Purple, Orange, Gray

function getSegmentColor(score) {
    if (score >= 60) return SAFE_COLOR;
    if (score >= 30) return MODERATE_COLOR;
    return DANGER_COLOR;
}

function MapClickHandler({ clickMode, onMapClick }) {
    useMapEvents({
        click(e) {
            if (clickMode && onMapClick) {
                const { lat, lng } = e.latlng;
                onMapClick(lat, lng);
            }
        },
    });
    return null;
}

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
    if (!routes?.routes?.length) return null;

    const selectedRoute = routes.routes[selectedIndex];
    if (!selectedRoute) return null;

    return (
        <>
            {routes.routes.map((route, rIdx) => {
                const isSelected = rIdx === selectedIndex;

                // If not selected, render as a single colored polyline from palette
                if (!isSelected) {
                    const coords = route.geometry?.coordinates?.map((c) => [c[1], c[0]]) || [];
                    const color = UNSELECTED_PALETTE[rIdx % UNSELECTED_PALETTE.length];
                    return (
                        <Polyline
                            key={`route-${rIdx}`}
                            positions={coords}
                            pathOptions={{ color, weight: 4, opacity: 0.6 }}
                        />
                    );
                }

                // If selected, group contiguous segments with same color to reduce component count
                const consolidatedSegments = [];
                if (route.segments?.length) {
                    let currentGroup = {
                        coords: [...route.segments[0].coords.map(c => [c[1], c[0]])],
                        color: getSegmentColor(route.segments[0].score)
                    };

                    for (let i = 1; i < route.segments.length; i++) {
                        const seg = route.segments[i];
                        const color = getSegmentColor(seg.score);
                        const segCoords = seg.coords.map(c => [c[1], c[0]]);

                        if (color === currentGroup.color) {
                            // Add only second point to avoid duplication if connected
                            currentGroup.coords.push(segCoords[1]);
                        } else {
                            consolidatedSegments.push(currentGroup);
                            currentGroup = {
                                coords: segCoords,
                                color: color
                            };
                        }
                    }
                    consolidatedSegments.push(currentGroup);
                }

                return consolidatedSegments.map((group, gIdx) => (
                    <Polyline
                        key={`group-${rIdx}-${gIdx}`}
                        positions={group.coords}
                        pathOptions={{
                            color: group.color,
                            weight: 6,
                            opacity: 1
                        }}
                    />
                ));
            })}

            {/* Danger Marks - Filtered for high intensity and limit count to prevent crash */}
            {selectedRoute.dangerPoints
                ?.filter(p => p.intensity > 0.5)
                .slice(0, 50)
                .map((p, i) => (
                    <CircleMarker
                        key={`danger-${i}`}
                        center={[p.lat, p.lng]}
                        radius={8 + p.intensity * 12}
                        pathOptions={{
                            color: '#ef4444',
                            fillColor: '#ef4444',
                            fillOpacity: 0.4,
                            weight: 1
                        }}
                    >
                        <Tooltip direction="top" className="danger-tooltip">
                            ⚠️ High Crime Risk ({Math.round(p.intensity * 100)}%)
                        </Tooltip>
                    </CircleMarker>
                ))}
        </>
    );
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

export function MapView({ routes, selectedIndex, from, to, clickMode, onMapClick }) {
    return (
        <div className="map-container">
            {clickMode && (
                <div className="map-click-hint">
                    Click on map to set {clickMode === 'from' ? 'origin' : 'destination'}
                </div>
            )}
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
                <MapClickHandler clickMode={clickMode} onMapClick={onMapClick} />
                <MapUpdater routes={routes} from={from} to={to} />
                <RoutePolylines routes={routes} selectedIndex={selectedIndex} />
                {from && <Marker position={[from.lat, from.lng]} icon={pinIcon} />}
                {to && <Marker position={[to.lat, to.lng]} icon={pinIconTo} />}
            </MapContainer>
            <div className="map-legend">
                <div className="legend-item"><span className="color-box safe"></span> Safe</div>
                <div className="legend-item"><span className="color-box moderate"></span> Moderate</div>
                <div className="legend-item"><span className="color-box danger"></span> Dangerous</div>
                <div className="legend-item">⚠️ Danger Hotspot</div>
            </div>
        </div>
    );
}
