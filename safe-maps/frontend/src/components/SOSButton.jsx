import { useState, useEffect, useCallback } from 'react';

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

async function reverseGeocode(lat, lng) {
    try {
        const params = new URLSearchParams({ lat, lon: lng, format: 'json', zoom: '16' });
        const res = await fetch(`${NOMINATIM_REVERSE}?${params}`, {
            headers: { 'User-Agent': 'SafeMaps Vancouver/1.0' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        const addr = data.address || {};
        const parts = [
            addr.house_number,
            addr.road || addr.pedestrian || addr.path,
            addr.suburb || addr.neighbourhood || addr.city_district || addr.city,
        ].filter(Boolean);
        return parts.length >= 2 ? parts.join(' ') : (data.display_name?.split(',').slice(0, 3).join(',').trim() ?? null);
    } catch {
        return null;
    }
}

function formatCoords(lat, lng) {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function SOSButton() {
    const [open, setOpen] = useState(false);
    const [location, setLocation] = useState(null);   // { lat, lng, address }
    const [locating, setLocating] = useState(false);
    const [copied, setCopied] = useState(false);

    const fetchLocation = useCallback(() => {
        if (!navigator.geolocation) return;
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                const address = await reverseGeocode(lat, lng);
                setLocation({ lat, lng, address });
                setLocating(false);
            },
            () => setLocating(false),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, []);

    // Fetch location as soon as modal opens
    useEffect(() => {
        if (open && !location) fetchLocation();
    }, [open, location, fetchLocation]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handle = (e) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', handle);
        return () => window.removeEventListener('keydown', handle);
    }, [open]);

    const locationText = location
        ? `${location.address ? location.address + '\n' : ''}${formatCoords(location.lat, location.lng)}`
        : null;

    const smsBody = location
        ? encodeURIComponent(`EMERGENCY – I need help. My location: ${location.address || ''} (${formatCoords(location.lat, location.lng)})`)
        : '';

    const googleMapsLink = location
        ? `https://maps.google.com/?q=${location.lat},${location.lng}`
        : null;

    const handleCopy = async () => {
        if (!locationText) return;
        const full = location.address
            ? `${location.address} — ${formatCoords(location.lat, location.lng)}`
            : formatCoords(location.lat, location.lng);
        try {
            await navigator.clipboard.writeText(full);
        } catch {
            const ta = document.createElement('textarea');
            ta.value = full;
            ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        if (!location) return;
        const text = `I need help. My location: ${location.address || ''} (${formatCoords(location.lat, location.lng)}) — ${googleMapsLink}`;
        if (navigator.share) {
            await navigator.share({ title: 'My location – Emergency', text }).catch(() => {});
        } else {
            await navigator.clipboard.writeText(text).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <>
            {/* Floating SOS trigger */}
            <button
                className="sos-trigger"
                onClick={() => setOpen(true)}
                aria-label="Emergency SOS"
                title="Emergency SOS"
            >
                SOS
            </button>

            {/* Modal overlay */}
            {open && (
                <div className="sos-overlay" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Emergency options">
                    <div className="sos-modal" onClick={(e) => e.stopPropagation()}>

                        {/* Header */}
                        <div className="sos-modal-header">
                            <span className="sos-modal-title">🚨 Emergency</span>
                            <button className="sos-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
                        </div>

                        {/* Call buttons */}
                        <div className="sos-call-row">
                            <a href="tel:911" className="sos-call-btn" onClick={() => setOpen(false)}>
                                📞 Call 911
                            </a>
                            <a
                                href={`sms:911${smsBody ? `?body=${smsBody}` : ''}`}
                                className="sos-sms-btn"
                                onClick={() => setOpen(false)}
                            >
                                💬 Text 911
                            </a>
                        </div>

                        {/* Location block */}
                        <div className="sos-location-block">
                            <p className="sos-location-label">Your current location</p>
                            {locating && <p className="sos-locating">Getting your location…</p>}
                            {!locating && location && (
                                <>
                                    {location.address && (
                                        <p className="sos-address">{location.address}</p>
                                    )}
                                    <p className="sos-coords">{formatCoords(location.lat, location.lng)}</p>
                                    {googleMapsLink && (
                                        <a
                                            href={googleMapsLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="sos-maps-link"
                                        >
                                            Open in Google Maps ↗
                                        </a>
                                    )}
                                </>
                            )}
                            {!locating && !location && (
                                <p className="sos-locating">
                                    Location unavailable.{' '}
                                    <button className="sos-retry" onClick={fetchLocation}>Retry</button>
                                </p>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="sos-actions">
                            <button className="sos-action-btn" onClick={handleCopy} disabled={!location}>
                                {copied ? '✓ Copied!' : '📋 Copy location'}
                            </button>
                            <button className="sos-action-btn" onClick={handleShare} disabled={!location}>
                                📤 Share location
                            </button>
                        </div>

                        {/* Safety tip */}
                        <p className="sos-tip">
                            Stay calm · Stay on the line · Tell them your location and what happened
                        </p>
                    </div>
                </div>
            )}
        </>
    );
}
