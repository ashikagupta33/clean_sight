# CleanSight

**AI-powered waste detection for public spaces.** A KIIT University project.

Upload a photo of a campus path, a park or a street. CleanSight finds the visible litter, draws a box around each item, counts it by type and keeps a history, so cleanup teams know where to go and can show the effect of a cleanup drive.

<!-- Add screenshots here: Dashboard, Scan & Detect results, Compare Cleanup -->

---

## Contents

1. [What it does](#1-what-it-does)
2. [How it works](#2-how-it-works)
3. [Project structure](#3-project-structure)
4. [Quick start](#4-quick-start)
5. [Configuration](#5-configuration)
6. [API reference](#6-api-reference)
7. [The model](#7-the-model)
8. [Data and privacy](#8-data-and-privacy)
9. [Troubleshooting](#9-troubleshooting)
10. [Decisions](#10-decisions)
11. [Contributing](#11-contributing)
12. [Known limitations and next steps](#12-known-limitations-and-next-steps)

---

## 1. What it does

| Page | What you can do |
|---|---|
| **Dashboard** | See total scans, total waste found, the most common category, the latest detection and a category breakdown |
| **Scan & Detect** | Upload one image, run detection, see the annotated image, counts by category and every detection with its confidence, and download a PDF report |
| **Analytics** | See the category distribution and the amount of waste detected per day |
| **Compare Cleanup** | Upload a before and an after photo of the same place and see the change per category |

Waste is detected in four model classes (`bottle`, `can`, `paper_cardboard`, `plastic_wrapper`) and shown in four categories: **Plastic, Paper, Metal, Other**.

---

## 2. How it works

```
 Browser (frontend/, plain HTML + CSS + JS)
    │
    │  POST /detect   (multipart form, field "file")
    │  GET  /history  GET /health
    ▼
 FastAPI backend (backend/app/main.py)
    │
    ├─ service.py   validate upload → decode image → run detector → build response
    ├─ detector.py  YOLOv8s on ONNX Runtime (CPU): letterbox → model → decode → NMS → boxes in original pixels
    └─ history.py   save the scan's numbers to SQLite (backend/data/cleansight.db)
```

1. The user picks an image on the Scan or Compare page. The frontend checks the type and size first.
2. `frontend/js/api.js` (the only file that talks to the backend) sends it to `POST /detect`.
3. The backend runs the model, saves the counts to the history and returns the detections as JSON.
4. The frontend groups the model labels into categories, draws the boxes on the image, and shows the counts. The PDF report is built in the browser.
5. Dashboard and Analytics read `GET /history`, so every device sees the same numbers.

---

## 3. Project structure

```
clean_sight/
├── README.md                    This file
├── decisions/                   Why things are built the way they are (start with decisions/README.md)
│
├── backend/                     Python FastAPI service
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py              FastAPI app, routes, CORS, model loading
│   │   ├── service.py           Upload validation, detection flow, response format
│   │   ├── detector.py          YOLOv8 ONNX inference (pre- and post-processing)
│   │   ├── history.py           SQLite scan history
│   │   └── config.py            Settings (all overridable with environment variables)
│   ├── models/
│   │   └── best.onnx            Trained model (YOLOv8s, 4 classes)
│   └── data/                    SQLite database is created here at runtime (not committed)
│
├── frontend/                    Static website, no build step
│   ├── index.html               Dashboard
│   ├── pages/                   scan.html, analytics.html, compare.html
│   ├── css/                     variables.css (design tokens), global.css, one file per page
│   ├── js/
│   │   ├── config.js            Backend URL, upload limits, category rules
│   │   ├── api.js               All backend calls + RESPONSE_MAP
│   │   ├── store.js             Loads history from the backend, keeps the latest scan locally
│   │   ├── upload.js            Upload checks and error messages (Scan + Compare)
│   │   ├── scan.js, compare.js, dashboard.js, analytics.js   One script per page
│   │   ├── imaging.js, charts.js, reports.js, navigation.js   Shared helpers
│   │   └── vendor/              Chart.js, jsPDF
│   └── assets/                  Images, fonts, icons, logo
│
└── ML/                          Model training
    ├── MLPro2.ipynb             Training notebook (TACO dataset → 4 classes, YOLOv8s)
    └── inference.py             Original Ultralytics inference script
```

---

## 4. Quick start

You need **Python 3.10 or newer**. Run the backend and the frontend in two terminals.

### Terminal 1: backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Check it at http://localhost:8000/health. You should see `"status": "ok"` and the four class names. Interactive API docs are at http://localhost:8000/docs.

### Terminal 2: frontend

```bash
cd frontend
python -m http.server 5500
```

Open http://localhost:5500.

The site must be served over HTTP. Opening the HTML files directly by double-clicking does not work. In VS Code you can instead right-click `frontend/index.html` and choose **Open with Live Server** (it also uses port 5500).

### Try it

1. Go to **Scan & Detect**, upload a photo with some litter and click **Run Detection**.
2. Download the PDF report.
3. Open **Dashboard** and **Analytics**: the scan is now counted.
4. Go to **Compare Cleanup** and upload a before and an after photo.

---

## 5. Configuration

### Backend (environment variables)

All settings have sensible defaults. Override them only if you need to.

| Variable | Default | Meaning |
|---|---|---|
| `CLEANSIGHT_MODEL_PATH` | `backend/models/best.onnx` | Path to the ONNX model |
| `CLEANSIGHT_CONF` | `0.25` | Minimum confidence for a detection |
| `CLEANSIGHT_IOU` | `0.7` | IoU threshold for non-maximum suppression |
| `CLEANSIGHT_DB_PATH` | `backend/data/cleansight.db` | SQLite history file |
| `CLEANSIGHT_MAX_UPLOAD_MB` | `10` | Largest accepted image |
| `CLEANSIGHT_CORS_ORIGINS` | `http://localhost:5500,http://127.0.0.1:5500` | Comma-separated list of frontend addresses allowed to call the API |

Example: serving the frontend on port 3000 instead:

```bash
CLEANSIGHT_CORS_ORIGINS="http://localhost:3000" uvicorn app.main:app --port 8000
```

### Frontend (`frontend/js/config.js`)

| Setting | Default | Meaning |
|---|---|---|
| `API_BASE_URL` | `http://localhost:8000` | Backend address, no trailing slash |
| `REQUEST_TIMEOUT_MS` | `60000` | How long to wait for a detection |
| `MAX_FILE_MB` | `10` | Keep equal to `CLEANSIGHT_MAX_UPLOAD_MB` |
| `ALLOWED_TYPES` | JPG, PNG, WEBP | Keep equal to the backend's allowed types |
| `USE_MOCK_API` | `false` | `true` generates fake results for layout testing only; they are labelled as demo and never saved |
| `CATEGORY_RULES` | see file | How model labels map to Plastic / Paper / Metal / Other |

`RESPONSE_MAP` at the top of `frontend/js/api.js` describes the response format. Its defaults already match this backend, so it only needs changing if the API changes.

---

## 6. API reference

Base URL: `http://localhost:8000`. Full interactive docs: `/docs`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Service and model status. Returns 503 if the model failed to load |
| `POST` | `/detect` | Detect waste in one image |
| `GET` | `/history?limit=500` | Recent scans, newest first (counts only) |
| `GET` | `/history/{id}` | One scan with all its detections |

### `POST /detect`

Send the image as `multipart/form-data` in the field **`file`**.

| Query parameter | Default | Meaning |
|---|---|---|
| `conf` | `0.25` | Confidence threshold for this request (0–1) |
| `save` | `true` | `false` skips saving this scan to the history |
| `annotate` | `false` | `true` also returns `annotated_image`, a JPEG data URL with boxes drawn |

```bash
curl -X POST -F "file=@photo.jpg" http://localhost:8000/detect
```

```json
{
  "id": "2750a04658f449528bc298ba6ad5ad09",
  "timestamp": "2026-11-27T08:05:33Z",
  "file_name": "photo.jpg",
  "image": { "width": 3264, "height": 2448 },
  "total": 2,
  "counts": { "bottle": 1, "can": 0, "paper_cardboard": 1, "plastic_wrapper": 0 },
  "detections": [
    { "label": "bottle", "confidence": 0.912, "bbox": [2297, 1086, 2839, 1267] },
    { "label": "paper_cardboard", "confidence": 0.608, "bbox": [1276, 1622, 1587, 1937] }
  ],
  "saved": true
}
```

- `bbox` is `[x1, y1, x2, y2]` in pixels of the original image.
- `confidence` is between 0 and 1.
- `counts` always lists every class, including those with 0.

### Errors

Errors return `{"detail": "message"}`.

| Status | When |
|---|---|
| 400 | The file is empty |
| 413 | The file is larger than the upload limit |
| 415 | Not a JPG, PNG or WEBP |
| 422 | The file isn't a readable image, or the `file` field is missing |
| 503 | The model isn't loaded (check the backend logs) |

---

## 7. The model

| | |
|---|---|
| Architecture | YOLOv8s, fine-tuned from the pretrained COCO checkpoint |
| Dataset | [TACO](https://github.com/pedropro/TACO) (Trash Annotations in Context), fine-grained classes merged into 4 |
| Classes | `bottle`, `can`, `paper_cardboard`, `plastic_wrapper` |
| Input size | 640 × 640 |
| Training | 50 epochs, batch 16, early stopping patience 15 (see `ML/MLPro2.ipynb`) |
| Served as | `backend/models/best.onnx`, run with ONNX Runtime on the CPU |

How model classes are shown in the app:

| Model class | Category |
|---|---|
| `bottle` | Plastic (the class also includes glass bottles) |
| `plastic_wrapper` | Plastic |
| `paper_cardboard` | Paper |
| `can` | Metal |

### Updating the model

1. Retrain in `ML/MLPro2.ipynb`.
2. Export with `model.export(format="onnx", imgsz=640)`.
3. Replace `backend/models/best.onnx` and restart the backend. Class names are read from the file, so no code change is needed.
4. If you add classes, add matching rules to `CATEGORY_RULES` in `frontend/js/config.js`; anything unmatched is shown as **Other**.

The YOLOv8 model is under the AGPL-3.0 licence from Ultralytics. See [decision 002](decisions/002-onnx-runtime-inference.md).

---

## 8. Data and privacy

- The backend stores **numbers only**: time, file name, image size, counts and boxes. Uploaded images are processed in memory and never saved on the server.
- The browser keeps a copy of the **latest** scan, with its images, so "View Details" and the PDF report work on that device.
- The history database (`backend/data/cleansight.db`) is ignored by git. Delete the file to reset the history.
- Don't commit API keys, private photos or the database to the repository.

---

## 9. Troubleshooting

| Problem | Cause and fix |
|---|---|
| Yellow warning "detection service isn't reachable" | The backend isn't running, or `API_BASE_URL` in `frontend/js/config.js` is wrong. Open http://localhost:8000/health. |
| `/health` returns 503 | The model file is missing or broken. The response's `detail` field says why. Check `backend/models/best.onnx`. |
| Red error "Can't reach the detection service" on upload | Usually CORS. The frontend's address (including the port) must be in `CLEANSIGHT_CORS_ORIGINS`. Press F12 and check the Console for a CORS message. |
| Dashboard says history couldn't be loaded | Same as above: the backend isn't reachable from the browser. |
| `ModuleNotFoundError` when starting the backend | Run `uvicorn` from inside `backend/`, with the virtual environment activated. |
| Page looks unstyled or the navbar is missing | The HTML file was opened directly. Serve `frontend/` over HTTP (see Quick start). |
| Old style or script after an update | Hard refresh with Ctrl + Shift + R. |
| Boxes look shifted | The backend returns original-image pixels. If you changed the API, check `boxFormat` and `boxUnits` in `RESPONSE_MAP`. |

---

## 10. Decisions

The [`decisions/`](decisions/README.md) folder explains the important choices: why FastAPI, why ONNX Runtime instead of PyTorch, how categories are mapped, how history is stored, the API format, and what was left for later. Read the relevant record before changing that part, and add a new record when you make a decision of similar weight.

---

## 11. Contributing

- Never rewrite shared history: no force-push to `main` and no rebasing of commits that are already pushed.
- Work on a branch (`feature/<short-name>`), push it, and open a pull request into `main`.
- Write code comments and documentation in English.
- When the API format changes, update `RESPONSE_MAP` in `frontend/js/api.js`, section 6 of this README and [decision 005](decisions/005-detect-api-contract.md) in the same pull request.

---

## 12. Known limitations and next steps

- Accuracy depends on the model. It was trained on 4 classes from TACO and can mistake bright or flat objects for litter, especially in aerial or wide shots. Photos taken from 1–3 m away work best.
- Image upload only. Video analysis (`/analyze-video`) isn't built yet.
- No Docker image, automated tests, location tags or hotspot map yet.
- SQLite suits a single server. Hosting on a service that wipes its disk on restart will lose the history.
- Tested in headless Chromium. Not yet tested in Safari or Firefox, or on physical phones.

See [decision 009](decisions/009-deferred-work.md) for the planned next steps.
