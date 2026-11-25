# CleanSight Frontend

Vanilla HTML/CSS/JS. No build step, no framework. Chart.js and jsPDF are vendored in `js/vendor/`; fonts and icons are self-hosted, so it works offline.

## Run
Serve the folder over HTTP (ES modules do not load from `file://`):

    cd cleansight-frontend
    python3 -m http.server 5500

Open http://localhost:5500. Use any port other than the backend's.

## Connect the backend (for the backend / ML team)
Edit only these two places:

1. `js/config.js`: `API_BASE_URL`, timeout, max file size, allowed types, and `CATEGORY_RULES` (model class label -> Plastic / Paper / Metal / Other).
2. `js/api.js`: the `RESPONSE_MAP` block at the top: upload field name, JSON field names, bounding-box format and units, and how the annotated image is returned.

Requests used: `POST /detect` (multipart form, one image) and `GET /health`. No other endpoints are called.

FastAPI must allow the frontend origin:

    app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5500"], allow_methods=["*"], allow_headers=["*"])

Assumed response (UNCONFIRMED; change `RESPONSE_MAP` if different):

    { "detections": [ { "label": "plastic_bottle", "confidence": 0.91, "bbox": [x1, y1, x2, y2] } ],
      "annotated_image": "<url | data URL | base64 JPEG>" }   // optional

If `annotated_image` is missing, CleanSight draws boxes and labels on the uploaded image from `bbox`.

## Data and history
There is no history endpoint. Dashboard and Analytics read scans stored in this browser's `localStorage` (`js/store.js`), so numbers are per device. Only real detections are stored. To use a backend later, replace `store.js`.

## Demo mode
`CONFIG.USE_MOCK_API = true` in `js/config.js` generates fake detections locally for layout testing. Results are labelled as demo data, are not saved, and the report says so. Keep it `false` otherwise.

## Images
Replace the placeholders in `assets/images/` with real KIIT photos using the same names: `hero-campus.jpg`, `dashboard-band.jpg`, `scan-side.jpg` (landscape, 1600px or wider).
