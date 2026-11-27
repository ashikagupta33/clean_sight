# 006. Scan history stored on the server in SQLite

- **Date:** 2026-11-27
- **Status:** Accepted

## Context
Dashboard and Analytics read history from the browser's `localStorage`. Each laptop or phone had its own separate numbers, which does not work for a team monitoring a campus.

## Decision
- The backend stores every scan in a SQLite file (`backend/data/cleansight.db`, ignored by git) as part of `POST /detect`. The frontend does not make a separate save call.
- `GET /history` returns recent scans (newest first). `GET /history/{id}` returns one scan with all its boxes.
- Only numbers are stored: time, file name, image size, counts and boxes. **Uploaded images are never written to disk.**
- The browser still keeps the **latest** scan, including its images, in `localStorage`. That copy powers the Latest Detection card and "View Details" on the device that made the scan.
- Scans from the Compare page are saved too, because they are real inspections. Pass `?save=false` to `/detect` to skip saving.
- Demo mode (`USE_MOCK_API`) never reaches the backend, so demo results are never saved.
- If the backend is down, Dashboard and Analytics show a warning and zeros instead of breaking.

## Consequences
- Every device sees the same totals, charts and trends.
- SQLite needs no setup and is enough for one server. If the app is ever run on several servers, or on a host whose disk is wiped on restart, move to a hosted database. Only `history.py` needs to change.
- Not storing images avoids keeping photos of people. The trade-off is that the annotated image of an old scan can't be reopened from another device.
- History recorded in `localStorage` before this change is not migrated.
