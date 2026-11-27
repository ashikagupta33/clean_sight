# CleanSight Frontend

Vanilla HTML, CSS and JavaScript. No build step and no framework. Chart.js and jsPDF are included in `js/vendor/`, and fonts and icons are self-hosted, so the site works offline.

For setup, configuration, the API and troubleshooting, see the [root README](../README.md).

## Run
Serve this folder over HTTP (ES modules do not load from `file://`):

    cd frontend
    python -m http.server 5500

Open http://localhost:5500. Start the backend too (see the root README), otherwise the pages show a "service isn't reachable" warning.

## Pages
| File | Page |
|---|---|
| `index.html` | Dashboard |
| `pages/scan.html` | Scan & Detect |
| `pages/analytics.html` | Analytics |
| `pages/compare.html` | Compare Cleanup |

## Where things live
- `js/config.js`: backend URL, timeout, upload limits, and `CATEGORY_RULES` (model label → Plastic / Paper / Metal / Other).
- `js/api.js`: the only file that calls the backend (`/detect`, `/health`, `/history`). `RESPONSE_MAP` at the top describes the response format; its defaults match the backend in `../backend`.
- `js/store.js`: loads the scan history from the backend and keeps the latest scan (with images) in `localStorage`.
- `js/upload.js`: upload checks and error messages shared by the Scan and Compare pages.
- `css/variables.css`: colours, fonts and spacing. Every other stylesheet uses these tokens.

## Demo mode
`USE_MOCK_API: true` in `js/config.js` generates fake detections locally for layout testing. Results are labelled as demo data, are never sent to or saved by the backend, and the PDF says so. Keep it `false` otherwise.

## Images
Replace the files in `assets/images/` with real KIIT photos, keeping the same names: `hero-campus.jpg`, `dashboard-band.jpg`, `scan-side.jpg` (landscape, 1600px wide or more, ideally under 500 KB).

## Design
Forest & Ivory palette (primary `#1F3D2B`, background `#F6F2E9`, text `#232824`; red and amber only for errors and warnings), Playfair Display for headings, DM Sans for everything else, and Lucide icons.
