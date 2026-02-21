# Safe Maps

**Find the safest walking route in Vancouver** — not just the fastest. Safe Maps considers historical crime data and street lighting to recommend routes that prioritize pedestrian safety.

---

## Docker Quick Start (Recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 1. Build data (one-time)

```bash
# Run from the safe-maps/ directory
npm run build-data
```

### 2. Start all services

```bash
npm run docker:prod
```

Open [http://localhost](http://localhost)

---

## Manual Quick Start (No Docker)

```bash
# Install all
npm run install:all

# Build data
npm run build-data

# Run (single command or two terminals)
npm run dev
# Or: npm run backend & npm run frontend
```

Open [http://localhost:5173](http://localhost:5173)

If data files are missing, the server still runs but returns neutral safety scores (50). Run the build-data script for full safety scoring.

### Demo presets

Click any preset in the sidebar for instant demo routes:
- Gastown → Yaletown
- Downtown → Strathcona
- East Hastings → Mount Pleasant

Or enter an address (e.g. "Gastown Vancouver"), coordinates (lat, lng), or click the Map button and pick a point on the map.

---

## Project Structure

```
safe-maps/
├── frontend/                # React + Vite + Leaflet frontend
│   ├── src/
│   ├── Dockerfile
│   └── ...
├── backend/                 # Express API + Data Pipeline
│   ├── src/
│   │   └── data/            # JSON data output
│   ├── scripts/             # Data fetching & grid building
│   ├── data/                # Raw input data (gitignored CSVs)
│   ├── Dockerfile
│   └── ...
├── docker-compose.yml
└── README.md
```

---

## Data Sources

| Data | Source |
|------|--------|
| Crime | [VPD GeoDASH](https://geodash.vpd.ca/opendata/) — Download CSV by year/neighbourhood, place in `backend/data/crime/` |
| Street lighting | [Vancouver Open Data](https://opendata.vancouver.ca/explore/dataset/street-lighting-poles/) |
| Routing | [OSRM](https://router.project-osrm.org/) (foot/walking profile) |

---

## API

```
GET /api/route?from=49.28,-123.12&to=49.27,-123.11&night=true
```
Returns `{ routes: [...], recommended: index }` — `recommended` is the index of the safest route.

```
GET /api/geocode?q=Gastown Vancouver
```
Returns `{ lat, lng, displayName }` for address search (Nominatim).

---

## Production

For production, set `VITE_API_URL` to your API base URL when building the client, e.g.:
```bash
VITE_API_URL=https://api.yoursite.com npm run build
```

---

## License

Open source. Data: Vancouver Open Government Licence.
