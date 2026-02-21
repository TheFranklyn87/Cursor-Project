export function RouteCard({ route, index, isRecommended, isSelected, onSelect }) {
  const durationMin = Math.round(route.duration / 60);
  const distanceKm = (route.distance / 1000).toFixed(2);
  const crimeScore = route.crimeScore ?? 50;
  const lightingScore = route.lightingScore ?? 50;
  const tags = [];
  if (crimeScore >= 60) tags.push('Lower crime');
  else if (crimeScore < 40) tags.push('Higher crime');
  if (lightingScore >= 60) tags.push('Well-lit');
  else if (lightingScore < 40) tags.push('Less lit');

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
      {(crimeScore !== 50 || lightingScore !== 50) && (
        <div className="route-breakdown">
          Crime: {crimeScore}/100 · Lighting: {lightingScore}/100
          {tags.length > 0 && (
            <span className="route-tags"> — {tags.join(', ')}</span>
          )}
        </div>
      )}
    </div>
  );
}
