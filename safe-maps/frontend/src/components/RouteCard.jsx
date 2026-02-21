export function RouteCard({ route, index, isRecommended, isSelected, onSelect }) {
  const durationMin = Math.round(route.duration / 60);
  const distanceKm = (route.distance / 1000).toFixed(2);

  return (
    <div
      className={`route-card ${isSelected ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}`}
      onClick={() => onSelect(index)}
    >
      <div className="route-header">
        {isRecommended && <span className="badge">Safest</span>}
        <span className="route-label">
          {index === 0 ? 'Fastest' : `Alternative ${index}`}
        </span>
      </div>
      <div className="route-stats">
        <span>{durationMin} min</span>
        <span>{distanceKm} km</span>
        <span className="safety">Safety: {route.safetyScore}/100</span>
      </div>
    </div>
  );
}
