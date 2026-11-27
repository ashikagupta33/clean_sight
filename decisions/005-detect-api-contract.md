# 005. `/detect` request and response format

- **Date:** 2026-11-27
- **Status:** Accepted

## Context
The frontend README listed its expected response as "assumed, not yet confirmed", and `ML/inference.py` returned a different shape (`class` instead of `label`, an annotated image saved to disk).

## Decision
The backend returns the shape the frontend already expected, so `RESPONSE_MAP` in `frontend/js/api.js` keeps its defaults.

**Request:** `POST /detect` with `multipart/form-data`, image in the field `file`. Optional query parameters: `conf` (0–1), `annotate` (true/false), `save` (true/false).

**Response (200):**
```json
{
  "id": "2750a04658f449528bc298ba6ad5ad09",
  "timestamp": "2026-11-27T08:05:33Z",
  "file_name": "path.jpg",
  "image": { "width": 3264, "height": 2448 },
  "total": 2,
  "counts": { "bottle": 1, "can": 0, "paper_cardboard": 1, "plastic_wrapper": 0 },
  "detections": [
    { "label": "bottle", "confidence": 0.912, "bbox": [2297, 1086, 2839, 1267] }
  ],
  "saved": true
}
```

- `bbox` is `[x1, y1, x2, y2]` in pixels of the **original** uploaded image, matching `boxFormat: "xyxy"` and `boxUnits: "pixels"`.
- `confidence` is between 0 and 1.
- `counts` lists every model class, including those with 0.
- Errors return `{"detail": "..."}` with: 400 empty file, 413 over the size limit, 415 wrong file type, 422 unreadable image or missing `file` field, 503 model not loaded.

**Annotated image:** the frontend draws boxes itself, in the CleanSight palette, from `bbox`. The backend only adds `annotated_image` (a JPEG data URL) when `?annotate=true` is passed, for API users who want a ready image. This keeps the normal response small.

## Consequences
- The frontend works without any `RESPONSE_MAP` changes.
- Upload limits (10 MB; JPG, PNG, WEBP) are the same on both sides: `CONFIG` in `frontend/js/config.js` and `config.py` in the backend. Change both together.
- Images are decoded with OpenCV, which applies the EXIF rotation the same way browsers do, so boxes line up with the photo the user sees.
