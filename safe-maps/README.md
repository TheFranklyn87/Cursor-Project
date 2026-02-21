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

## Manual Quick Start (No Docker)

```bash
# Install all
npm run install:all

# Build data
npm run build-data

# Run
npm run backend
npm run frontend
```
