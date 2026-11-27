# CleanSight: Frontend

CleanSight is an AI-powered waste detection platform (KIIT University project). A user uploads a photo of a public space. The backend runs a YOLO model, and this frontend shows the detected waste, category counts, an annotated image and a downloadable PDF report.

**This folder is the frontend only.** The ML model and FastAPI backend are separate.

<!-- Add screenshots here: Dashboard, Scan & Detect results, Analytics -->

---

## 1. What the website does

| Page | What it shows |
|---|---|
| **Dashboard** (`index.html`) | Total scans, total waste detected, most detected category, latest detection, category chart |
| **Scan & Detect** (`pages/scan.html`) | Upload image, run detection, annotated result, counts, **Download Report (PDF)**, Scan Another |
| **Analytics** (`pages/analytics.html`) | Category distribution (donut chart) and daily detection trend (bar chart) |

Errors handled: wrong file type, empty file, file too large, backend unreachable, timeout, invalid response, and no waste found.

Tech: plain HTML, CSS and JavaScript. No framework, no build step. Chart.js and jsPDF are included in `js/vendor/`; fonts and icons are included too, so it works offline.

---

## 2. Project structure

```
cleansight-frontend/
├── index.html                  Dashboard page
├── README.md
├── pages/
│   ├── scan.html               Scan & Detect page
│   └── analytics.html          Analytics page
├── css/
│   ├── variables.css           Colours, fonts, spacing (design tokens)
│   ├── global.css              Buttons, cards, alerts, shared styles
│   ├── navbar.css
│   ├── dashboard.css
│   ├── scan.css
│   └── analytics.css
├── js/
│   ├── config.js               ★ Backend URL, limits, categories
│   ├── api.js                  ★ ALL backend calls + RESPONSE_MAP
│   ├── scan.js                 Upload, validation, detection flow, results
│   ├── dashboard.js            Dashboard data and chart
│   ├── analytics.js            Analytics data and charts
│   ├── reports.js              PDF report generation
│   ├── store.js                Scan history (saved in the browser)
│   ├── charts.js               Chart helpers
│   ├── imaging.js              Draws boxes and labels on images
│   ├── navigation.js           Shared navigation bar
│   ├── app.js                  Entry point loaded on every page
│   ├── mock/mock-detect.js     Fake data for layout testing (off by default)
│   └── vendor/                 chart.umd.js, jspdf.umd.min.js
└── assets/
    ├── images/                 hero-campus.jpg, dashboard-band.jpg, scan-side.jpg
    ├── fonts/
    ├── icons/sprite.svg
    └── logo/logo.svg
```

★ = the only two files the backend/ML team ever needs to edit.

---

## 3. Run the frontend

The site must be served over HTTP. Double-clicking the HTML files will **not** work.

**Option A: VS Code (easiest)**
1. Open the `cleansight-frontend` folder in VS Code.
2. Install the **Live Server** extension (by Ritwick Dey).
3. Right-click `index.html` and choose **Open with Live Server**.

**Option B: Terminal**
```
cd cleansight-frontend
python3 -m http.server 5500        # Windows: python -m http.server 5500
```
Open http://localhost:5500

Without a backend the site still opens. You will see a yellow warning on the Scan page ("detection service isn't reachable"). That is expected.

---

## 4. How the frontend connects to the backend

```
 Browser (Scan page)
      │  1. user picks an image
      ▼
   scan.js ──▶ api.js ── POST  {API_BASE_URL}/detect   (multipart form, field "file")
                                   │
                                   ▼
                          FastAPI + YOLO (backend)
                                   │  2. returns JSON
                                   ▼
   api.js  normalises the JSON using RESPONSE_MAP
      │  3. result = { detections, counts, total, annotated image }
      ▼
   scan.js  draws the result, saves the scan to history
   reports.js  builds the PDF from the same result
```

Key idea: **only `api.js` talks to the backend.** The rest of the UI works with one fixed internal format, so if the backend's JSON differs from what the frontend expects, you change `RESPONSE_MAP` and nothing else.

### Endpoints used

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/detect` | Send one image, receive detections |
| `GET` | `/health` | Checked when the Scan page loads, to warn the user if the service is down |

No other endpoints are called.

---

## 5. Step-by-step: connect the backend

### Step 1: Start the backend
Run FastAPI, for example on `http://localhost:8000`.

### Step 2: Allow the frontend in CORS (backend side)
Without this, the browser blocks every request. Add this to the FastAPI app:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500", "http://127.0.0.1:5500"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```
Use the port your frontend actually runs on. If the frontend is hosted on `https`, the backend must be `https` too.

### Step 3: Set the backend URL (frontend side)
In `js/config.js`:
```js
API_BASE_URL: "http://localhost:8000",   // no trailing slash
```

### Step 4: Look at the real response
Run this in a terminal with any test image:
```
curl -X POST -F "file=@test.jpg" http://localhost:8000/detect
```
If this fails with "field required", the upload field is not called `file`. Note the field name that works.

### Step 5: Match `RESPONSE_MAP` to the real response
Open the top of `js/api.js`. These are the settings:

| Setting | Meaning | Default |
|---|---|---|
| `uploadField` | Name of the form field that carries the image | `"file"` |
| `detectionsKeys` | Name(s) of the array holding detections (first match is used) | `detections`, `predictions`, `results`, `objects` |
| `labelKeys` | Name(s) of the class label | `label`, `class_name`, `class`, `name` |
| `confidenceKeys` | Name(s) of the confidence. 0–1 and 0–100 both work | `confidence`, `score`, `conf` |
| `boxKeys` | Name(s) of the box. An array of 4 numbers or `{x1,y1,x2,y2}` | `bbox`, `box`, `xyxy` |
| `boxFormat` | How the 4 numbers are arranged | `"xyxy"` |
| `boxUnits` | `"pixels"` or `"normalized"` (0–1) | `"pixels"` |
| `annotatedKeys` | Name(s) of the annotated image (optional) | `annotated_image`, `annotated_image_url`, `image_url` |

Box formats:

| `boxFormat` | The 4 numbers mean |
|---|---|
| `"xyxy"` | `[left, top, right, bottom]` |
| `"xywh"` | `[left, top, width, height]` |
| `"cxcywh"` | `[centre x, centre y, width, height]` |

The most common changes are `uploadField`, `boxFormat` and `boxUnits`. Many field names are already accepted automatically.

**Example.** Backend returns:
```json
{ "predictions": [ { "class": "bottle", "score": 0.88, "box": [120, 80, 60, 140] } ] }
```
Boxes here are `[x, y, width, height]` in pixels, so set only:
```js
boxFormat: "xywh",
```
Everything else is matched already.

**Important for the ML/backend team:** box pixels must be relative to the **original uploaded image**, not a resized copy (YOLO often resizes to 640). If boxes appear shifted or too small on the result, convert them back to the original size on the backend, or return `normalized` (0–1) values and set `boxUnits: "normalized"`.

### Step 6: Map the model's class names to categories
The dashboard groups waste into **Plastic, Paper, Metal and Other**. In `js/config.js`, adjust `CATEGORY_RULES` to your model's real class names:
```js
const CATEGORY_RULES = [
  ["Plastic", /plastic|bottle|bag|cup|wrapper|straw/i],
  ["Paper",   /paper|cardboard|carton|tissue|newspaper/i],
  ["Metal",   /metal|\bcan\b|\btin\b|foil|alumin/i],
];
```
Anything that does not match goes to **Other**. If a class name is exactly "Plastic", "Paper", "Metal" or "Other", it is used directly.

### Step 7: Test it
1. Open the Scan page. There should be no yellow warning.
2. Upload an image with visible waste and click **Run Detection**.
3. Check the checklist:

- [ ] Boxes sit on the right objects
- [ ] Labels and confidence look right
- [ ] Category counts and total are correct
- [ ] **Download Report (PDF)** opens correctly
- [ ] Dashboard and Analytics now show the scan

---

## 6. Expected response (assumed, NOT yet confirmed)

Until the backend team confirms the real format, the frontend assumes:

```json
{
  "detections": [
    { "label": "plastic_bottle", "confidence": 0.91, "bbox": [120, 80, 260, 300] }
  ],
  "annotated_image": "<URL, data URL or base64 JPEG>"
}
```

- `annotated_image` is optional. If it is missing, the frontend draws the boxes and labels on the uploaded image itself.
- Counts and the total are calculated from the `detections` list.
- Relative image URLs (starting with `/`) are loaded from `API_BASE_URL`.

---

## 7. Troubleshooting

| Problem | Cause and fix |
|---|---|
| Yellow warning "detection service isn't reachable" | Backend is not running, or `API_BASE_URL` is wrong. Check `/health` in the browser. |
| Red error "Can't reach the detection service" | Same as above, or CORS is not enabled. Open F12 → Console; a CORS message confirms it. |
| Error "response CleanSight couldn't read" | JSON field names differ. Check `RESPONSE_MAP` against the `curl` output from Step 4. |
| HTTP 422 error | Wrong upload field name. Fix `uploadField`. |
| Boxes in the wrong place or wrong size | Wrong `boxFormat`, `boxUnits`, or boxes are for a resized image (see Step 5). |
| Everything counted as "Other" | Class names don't match `CATEGORY_RULES` (Step 6). |
| Page looks unstyled or navbar missing | The files were opened directly. Use Live Server or the terminal command. |
| Photo or style didn't update | Hard refresh with Ctrl + Shift + R. |
| Dashboard shows 0 on another laptop | History is stored per browser (see below). |

---

## 8. Data and history

There is no history endpoint, so the Dashboard and Analytics read scans saved in the browser's `localStorage` (`js/store.js`).

- Only real detections are saved.
- History is **per browser and per device**.
- To use a backend history later, replace `store.js` and keep the same exported functions.

---

## 9. Demo mode

Set `USE_MOCK_API: true` in `js/config.js` to generate fake detections for layout testing. Results are clearly labelled as demo data, are **not** saved, and the PDF is marked as demo. Always set it back to `false` for real use.

---

## 10. Campus photos

Replace the files in `assets/images/` with real KIIT photos, **keeping the same names**:

| File | Used for |
|---|---|
| `hero-campus.jpg` | Dashboard hero |
| `dashboard-band.jpg` | Dashboard bottom banner |
| `scan-side.jpg` | Scan page side image (desktop only) |

Landscape JPG, at least 1600px wide, ideally under 500 KB.

---

## 11. Design

- **Colours:** Forest & Ivory palette. Primary `#1F3D2B`, background `#F6F2E9`, text `#232824`. Red and amber are used only for errors and warnings.
- **Fonts:** Playfair Display (headings), DM Sans (everything else).
- **Icons:** Lucide, one stroke width.
- All values are CSS variables in `css/variables.css`.

---

## 12. Testing status

Tested in headless Chromium with simulated `/detect` responses: upload validation, success, no detections, HTTP 413 and 500, non-JSON and wrong-shape responses, backend down, timeout, PDF download, charts, navigation, and layouts from 320px to 1440px.

**Not yet tested:** against the real backend, in Safari or Firefox, or on physical phones.

## 13. Known limitations

- History is per browser, not stored on a server.
- Detection accuracy depends on the ML model, not the frontend.
- Video analysis (`/analyze-video`) is not part of this frontend.
- The `/detect` response format is an assumption until the backend team confirms it.

