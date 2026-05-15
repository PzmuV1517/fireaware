# FireAware — Design Document

Crowdsourced fire-spotting platform. Users photograph distant fires; the app records GPS position + compass bearing of each shot. The backend triangulates the intersection of bearings from multiple reports to locate fires and renders them on a public map.

---

## 1. Tech stack (resolved)

| Layer | Choice |
|---|---|
| Backend | **FastAPI** (Python 3.12), Uvicorn, Pydantic v2 |
| DB | **PostgreSQL 16** + **PostGIS** extension (geospatial indexing + intersection math) |
| Migrations | Alembic |
| Auth | JWT (access + refresh) via `fastapi-users` or hand-rolled with `passlib[bcrypt]` + `python-jose` |
| Object storage | S3-compatible (MinIO locally, S3 in prod) for fire photos |
| Frontend | **Single Expo app** (`expo`), one codebase, started with `--web` / `--ios` / `--android` |
| Map | **MapLibre GL** — `maplibre-gl` on web (via Expo web), `@maplibre/maplibre-react-native` on native |
| State / data | TanStack Query + Zustand |
| Forms / validation | `zod` + `react-hook-form` |
| Tiles | MapTiler (free tier) or self-hosted OSM raster tiles |

> Note on Vite: Expo's web target uses Metro, not Vite. Using a single Expo codebase means dropping Vite. If Vite is non-negotiable we'd need a monorepo split (separate Vite web app + Expo mobile app sharing a UI package) — flagging here, but the chosen direction is single Expo app.

---

## 2. Repository layout

```
fireaware/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/            # config, security, db session
│   │   ├── models/          # SQLAlchemy ORM
│   │   ├── schemas/         # Pydantic
│   │   ├── api/v1/          # routers: auth, reports, fires, users
│   │   ├── services/        # triangulation, clustering, storage
│   │   └── workers/         # background recompute (celery/arq, optional)
│   ├── alembic/
│   ├── tests/
│   ├── pyproject.toml
│   └── Dockerfile
├── app/                     # Expo single-codebase frontend
│   ├── app/                 # expo-router routes
│   │   ├── (web)/index.tsx          # public map, no auth
│   │   ├── (mobile)/_layout.tsx
│   │   ├── (mobile)/map.tsx
│   │   ├── (mobile)/report/         # capture + calibration flow
│   │   └── (mobile)/auth/
│   ├── components/
│   │   ├── map/             # MapView wrapper that picks web vs native impl
│   │   ├── ui/              # design-system primitives
│   │   └── calibration/
│   ├── lib/                 # api client, auth, sensors
│   ├── theme/               # fonts, tokens
│   ├── app.json
│   └── package.json
├── docker-compose.yml       # postgres+postgis, minio, backend
└── DESIGN.md
```

The `(web)` and `(mobile)` route groups in expo-router let us gate which screens load per platform without forking the codebase. `Platform.OS === 'web'` guards in `_layout.tsx` redirect web visitors to the map and hide auth/report routes entirely.

---

## 3. Data model

```sql
users
  id              uuid pk
  email           text unique
  password_hash   text
  display_name    text
  created_at      timestamptz
  is_verified     bool

reports
  id              uuid pk
  user_id         uuid fk -> users
  location        geography(Point, 4326)     -- where the photo was taken
  bearing_deg     real         -- 0..360, true north
  bearing_acc_deg real         -- compass accuracy cone half-angle
  gps_acc_m       real         -- GPS horizontal accuracy radius
  photo_url       text
  taken_at        timestamptz
  device_meta     jsonb        -- model, sensor info, calibration scores
  fire_id         uuid fk -> fires nullable   -- assigned by triangulation
  status          text         -- 'pending' | 'matched' | 'rejected'

fires
  id              uuid pk
  centroid        geography(Point, 4326)
  confidence      real         -- 0..1, derived from #reports + geometry quality
  first_seen_at   timestamptz
  last_seen_at    timestamptz
  report_count    int
  bbox            geography(Polygon, 4326)
  is_active       bool
```

Indexes: `GIST(location)` on reports, `GIST(centroid)` on fires, `(taken_at DESC)` on reports, `(is_active, last_seen_at DESC)` on fires.

---

## 4. Triangulation approach

Each report defines a **bearing ray** from `location` in direction `bearing_deg`, widened into a **wedge** by `bearing_acc_deg` (compass uncertainty) and `gps_acc_m` (origin uncertainty).

**Algorithm (v1, geometric):**

1. **Candidate selection.** For each new report `R`, find all unresolved reports within a configurable radius (e.g. 50 km) and within a time window (e.g. ±2 hours) where the bearings could plausibly intersect (rays not parallel, not pointing away from each other).
2. **Pairwise intersection.** For each candidate pair, compute the intersection point of the two bearing rays on the WGS84 sphere (great-circle bearing intersection — closed-form solution exists). Discard if intersection is "behind" either origin.
3. **Uncertainty scoring.** For each intersection point, compute distance-from-origin and check it falls inside both wedges. Score = `f(wedge_overlap_area, distance, gps_acc, age)`.
4. **Clustering.** Run DBSCAN (eps ≈ 200 m, minPts = 2) on the set of valid intersection points. Each cluster → one `fire` row; its `centroid` = mean of points weighted by score; `confidence` = aggregate score normalized to 0..1.
5. **Assignment.** Reports contributing to a cluster get `fire_id` set; orphan reports stay `pending` (single sighting, no triangulation yet — still shown as low-confidence dots).

**v1 is a stateless recompute** triggered when a new report arrives in a region: pull recent reports for that area, recompute clusters, upsert fires. This is cheap up to thousands of active reports and avoids incremental-state bugs.

PostGIS does the heavy lifting (ST_DWithin, ST_Intersection, ST_Distance). Bearing-ray math is custom Python (small module in `services/triangulation.py`) since PostGIS doesn't have a built-in for bearing-cone intersection.

**Edge cases noted, not solved in v1:** stale reports (TTL on contribution), malicious/spoofed reports (per-user rate limit + report quality score), parallax from very distant fires (bearing precision dominates).

---

## 5. API surface (REST, JSON, v1)

Public (no auth):
- `GET /api/v1/fires` — list active fires (bbox query, since-timestamp). For the public web map.
- `GET /api/v1/fires/{id}` — fire detail + contributing report thumbnails.

Authenticated (mobile only):
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login` → access + refresh JWT
- `POST /api/v1/auth/refresh`
- `GET  /api/v1/users/me`
- `POST /api/v1/reports` — multipart: photo + JSON `{lat, lon, bearing_deg, bearing_acc_deg, gps_acc_m, taken_at, device_meta}`. Returns the report + the fire it was matched to (if any) after triangulation runs.
- `GET  /api/v1/reports/mine` — user's own report history.

Rate limits: 1 report / 30 s / user, 60 fires-list req / min / IP.

---

## 6. Mobile flows

### 6.1 Onboarding
Email + password → JWT stored in `expo-secure-store`. No social login in v1.

### 6.2 Map screen
Same MapView as web, plus:
- Floating "Report a fire" CTA.
- Pulls `/fires` for visible bbox; refreshes every 30 s.

### 6.3 Report flow (the substantive UX)

Four steps, each blocking until passed:

1. **GPS precision check**
   - Read `expo-location` accuracy. Require `accuracy ≤ 20 m`.
   - If not met: show animated "move to open sky" instructions, live-update accuracy reading. Block until threshold or user explicitly overrides (override is recorded in `device_meta` and downweights the report).

2. **Compass calibration**
   - Use `expo-sensors` `Magnetometer` + heading from `Location.watchHeadingAsync`.
   - Show the standard figure-8 calibration animation. Internally measure heading jitter over a 3-second window; require σ < 3°.
   - On iOS we surface `accuracy` from `headingAccuracy`; on Android we estimate it from magnetometer variance since accuracy reporting is unreliable.

3. **Capture**
   - Camera preview (`expo-camera`) with a centered crosshair and a live heading overlay (e.g. "Bearing: 247°").
   - At shutter press, atomically snapshot: photo, GPS fix, heading, both accuracies, timestamp.

4. **Confirm + submit**
   - Show captured photo, location pin on a mini map, bearing arrow.
   - "Submit" uploads to backend; on success show the triangulated fire (if matched) or a "First sighting — needs another report to confirm" state.

### 6.4 Permissions
Camera, location (foreground), motion sensors. Requested just-in-time at first report attempt.

---

## 7. Web flow

Single page. MapLibre map filling the viewport. Header with logo + a small "Get the app to report" link. Clicking a fire marker opens a side panel with photos + timestamps. No auth, no submission. Fully cacheable behind a CDN.

---

## 8. Design system (Claude-inspired)

**Typography**
- Headings & UI labels: **blocky / geometric sans** — `Founders Grotesk` (paid) or free alternative `Space Grotesk` / `Inter Tight` at heavy weights. Tight tracking, generous size jumps.
- Body and especially **subtext / captions / metadata**: **calligraphic serif with italic flair** — `EB Garamond Italic` or `Cormorant Garamond Italic` for taglines and helper text, evoking Claude's hand-written subtext feel.
- Monospace (data, coordinates, bearings): `JetBrains Mono` or `IBM Plex Mono`.

**Color palette** (no neon, warm + earthy, signal-orange reserved for fire data):

| Token | Hex | Usage |
|---|---|---|
| `bg` | `#F7F4EE` | App background (warm off-white, paper) |
| `surface` | `#FFFFFF` | Cards, panels |
| `ink` | `#1A1714` | Primary text |
| `ink-muted` | `#6B6258` | Secondary text |
| `accent` | `#C9532A` | Fire signal (markers, confirm buttons) — burnt orange, not neon |
| `accent-soft` | `#E89B6F` | Low-confidence fires |
| `border` | `#E5DFD3` | Hairlines |
| `success` | `#5A7F3C` | Calibration passed |
| `warn` | `#B8862E` | Calibration partial |

Dark mode: invert `bg`/`ink` to `#171411` / `#EFE9DD`; keep accent stable.

**Other**
- Hairline 1px borders, generous whitespace, no shadows except a single soft elevation token.
- Motion: slow, eased, no bounce. Map markers fade in over 600 ms.
- Icons: lucide-react / lucide-react-native, stroke 1.5.

---

## 9. Local dev

```bash
# from repo root
docker compose up -d   # postgres+postgis, minio
cd backend && uv sync && alembic upgrade head && uvicorn app.main:app --reload
cd app && pnpm install && pnpm expo start            # then press w / i / a
```

Seeded with a small set of synthetic reports around a fictional fire so the map isn't empty on first run.

---

## 10. Implementation milestones

1. **M1 — Backend foundation.** FastAPI app, Postgres + PostGIS via docker-compose, Alembic migrations, user/report/fire models, auth endpoints, `POST /reports` storing rows but no triangulation yet, `GET /fires` returning rows.
2. **M2 — Triangulation service.** Bearing-ray intersection module + DBSCAN clustering, recompute trigger on new report, fire upsert. Tests with synthetic geometries.
3. **M3 — Expo scaffold + design system.** Theme tokens, fonts loaded, navigation skeleton, platform-split routing, API client.
4. **M4 — Public web map.** MapView wrapper, fires layer, fire detail side panel. Ship this independently — it's the public surface.
5. **M5 — Mobile auth + map.** Login/register, secure token storage, same map screen plus the "Report" CTA.
6. **M6 — Report flow.** GPS check → compass calibration → camera capture → confirm → submit, with all four blocking gates.
7. **M7 — Polish.** Photo upload to S3/MinIO, rate limiting, error states, empty/first-sighting state, basic moderation flag endpoint.

Each milestone is independently runnable and demoable.

---

## 11. Open questions

- **Tiles**: MapTiler key vs self-hosted? Affects cost and offline story.
- **Moderation**: do we need a manual review queue in v1, or is per-user quality score enough?
- **Public report visibility**: should single unmatched reports appear on the public map as "unconfirmed"? Leaning yes with a distinct style.
- **Geographic scope**: global from day 1, or geo-fence to a launch region?
- **Triangulation latency**: synchronous in the `POST /reports` request (simple, slower) vs queued worker (more code, snappier UX). v1 = synchronous; revisit if p95 > 1 s.

These don't block scaffolding — flagging so we can decide before the relevant milestone.
