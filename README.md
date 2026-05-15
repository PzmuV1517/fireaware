# FireAware

Crowdsourced fire-spotting platform. Mobile users photograph distant fires; the backend triangulates bearings from multiple sightings and renders confirmed fires on a public map.

See [DESIGN.md](DESIGN.md) for architecture, data model, triangulation algorithm, and milestone plan.

## Stack

- **Backend** — FastAPI + PostgreSQL/PostGIS + Alembic + JWT auth + bearing-ray triangulation
- **Frontend** — single Expo app (`--web` / `--ios` / `--android`) using MapLibre GL, expo-router, expo-camera, expo-sensors

## Quick start

```bash
# 1. Start postgres+postgis and minio
docker compose up -d

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
python scripts/seed.py            # creates demo user + 4 reports → 1 triangulated fire
uvicorn app.main:app --reload     # http://localhost:8000
```

Demo account: `demo@fireaware.dev` / `demo-password-123`

```bash
# 3. Frontend (in another terminal)
cd app
npm install
npx expo start                    # press w / i / a
```

## How it works

1. **Mobile user** opens the report flow → app gates them through GPS precision check (≤ 20 m) and compass calibration (jitter < 3°).
2. At shutter press, the app captures `{photo, lat, lon, bearing, gps_acc, bearing_acc, timestamp}` atomically.
3. **Backend** receives the report, uploads the photo to S3/MinIO, and runs `recompute_for_region`:
   - Pulls recent reports within 50 km and ±2 h
   - Computes pairwise great-circle bearing-ray intersections
   - Validates each intersection falls inside both bearings' uncertainty wedges
   - DBSCAN-clusters the intersection points (eps = 200 m, minPts = 2)
   - Each cluster becomes one `Fire` row with confidence proportional to report count and cluster tightness
4. **Web visitors** see `Fire` markers on a MapLibre map at `/`. No login required.

## Repo layout

```
backend/          FastAPI app, Alembic migrations, triangulation service, seed script
app/              Expo single-codebase frontend (web + iOS + Android)
docker-compose.yml  Postgres+PostGIS + MinIO
DESIGN.md         Full architecture + algorithm notes
```

## Key endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/api/v1/fires`         | – | List active fires (optional bbox) |
| GET  | `/api/v1/fires/{id}`    | – | Fire detail + contributing photos |
| POST | `/api/v1/auth/register` | – | Create account |
| POST | `/api/v1/auth/login`    | – | Get token pair |
| POST | `/api/v1/auth/refresh`  | – | Refresh access token |
| GET  | `/api/v1/users/me`      | ✓ | Current user |
| POST | `/api/v1/reports`       | ✓ | Submit sighting (multipart) |
| GET  | `/api/v1/reports/mine`  | ✓ | User's reports |
