# Screenshots used by the top-level README

Captured live against the running stack (seed = `seed.py` + `seed_romania.py`,
fireman account = `fireman@fireaware.dev`). All shots are headless-Chromium
via Playwright: desktop at 1600 × 900 @2×, mobile at 390 × 844 @3× with an
iPhone user-agent.

| File | What it shows | Viewport |
|---|---|---|
| `web-map.png` | Public map, 5 Romania fires, weather widget | 1600 × 900 |
| `web-map-weather.png` | Reports toggle on, weather widget expanded | 1600 × 900 |
| `mission-control.png` | Fireman Mission Control sidebar | 1600 × 900 |
| `mobile-map.png` | Mobile public map, anonymous | 390 × 844 |
| `mobile-login.png` | Mobile sign-in screen | 390 × 844 |
| `mobile-mission-control.png` | Mobile fireman Mission Control | 390 × 844 |
| `mobile-fire-detail.png` | Mobile fire detail (coords, confidence, timestamps) | 390 × 844 |
| `web-fire-detail.png` | Desktop fire detail (same data, wider layout) | 1600 × 900 |

To re-capture, bring the stack up (`docker compose up -d postgres` +
`uvicorn app.main:app` + `npx expo start --web`), seed, and re-run the
Playwright script from the session scratchpad.
