# Safe Maps

**Find the safest walking route in Vancouver** — not just the fastest. Safe Maps considers historical crime data and street lighting to recommend routes that prioritize pedestrian safety.

## Features

- **Safety-first routing**: Compares multiple route alternatives and ranks them by safety score
- **Crime awareness**: Uses Vancouver crime data (VPD GeoDASH) to avoid high-incident areas
- **Street lighting**: Factors in street light density for night walking
- **Night mode**: Toggle "Walking at night" to weight lighting more heavily

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### 1. Install dependencies

```bash
cd safe-maps
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

### 2. Build data (one-time)

```bash
node scripts/fetch-crime.js   # Uses demo grid if no CSV; place VPD CSVs in data/crime/ for real data
node scripts/fetch-lighting.js # Fetches street lighting from Vancouver Open Data
```

### 3. Run the app

**Terminal 1 — API server:**
```bash
cd server && npm start
```

**Terminal 2 — Frontend:**
```bash
cd client && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Demo presets

Click any preset in the sidebar for instant demo routes:
- Gastown → Yaletown
- Downtown → Strathcona
- East Hastings → Mount Pleasant

Or enter coordinates (lat, lng) manually.

## Data Sources

| Data | Source |
|------|--------|
| Crime | [VPD GeoDASH](https://geodash.vpd.ca/opendata/) — Download CSV by year/neighbourhood, place in `data/crime/` |
| Street lighting | [Vancouver Open Data](https://opendata.vancouver.ca/explore/dataset/street-lighting-poles/) |
| Routing | [OSRM](https://router.project-osrm.org/) (foot/walking profile) |

## Project Structure

```
safe-maps/
├── client/         # React + Vite + Leaflet frontend
├── server/         # Express API (routing, scoring)
├── scripts/        # Data pipeline (crime, lighting)
├── data/           # Raw data (gitignored CSVs)
└── README.md
```

## API

```
GET /api/route?from=49.28,-123.12&to=49.27,-123.11&night=true
```

Returns `{ routes: [...], recommended: index }` — `recommended` is the index of the safest route.

## License

Open source. Data: Vancouver Open Government Licence.
