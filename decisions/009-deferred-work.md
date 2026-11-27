# 009. Work deliberately left for later

- **Date:** 2026-11-27
- **Status:** Accepted

## Context
The brief lists more than the minimum product. The scope of this round was: build the backend and make every existing frontend page work with it.

## Decision
These items were left out on purpose and can be picked up next:

| Item | Notes |
|---|---|
| Dockerfile | The brief lists Docker for deployment. The backend has no system dependencies beyond pip packages, so a `python:3.12-slim` image with `opencv-python-headless` and `onnxruntime` is enough. |
| `POST /analyze-video` | Optional in the brief, and the frontend has no video UI. `ML/inference.py` has a starting point. Long videos should run as a background job. |
| Automated tests | The backend logic was checked by hand (see decision 002). `service.py`, `detector.py` and `history.py` don't import FastAPI, so they are easy to cover with `pytest`. |
| Location tags and hotspot map | "Beyond the MVP" in the brief. The history table would need latitude and longitude columns. |
| Comparison PDF | Compare shows results on screen only. |

## Consequences
None of these block the current app. Each one should get its own decision record when it is built.
