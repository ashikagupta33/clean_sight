# 001. Backend in Python with FastAPI

- **Date:** 2026-11-27
- **Status:** Accepted

## Context
The frontend was finished and expected a backend at `POST /detect` and `GET /health`, but no backend existed. The project brief suggests "Python + FastAPI + Docker", and the ML team's work (training notebook, `ML/inference.py`) is in Python.

## Decision
The backend is a FastAPI application in `backend/`. The code is split so that HTTP handling stays thin:

| File | Responsibility |
|---|---|
| `app/main.py` | FastAPI app, routes, CORS, model loading at startup |
| `app/service.py` | Upload validation, image decoding, building the response, saving history |
| `app/detector.py` | YOLOv8 inference with ONNX Runtime (pre- and post-processing) |
| `app/history.py` | SQLite scan history |
| `app/config.py` | All settings, each overridable with an environment variable |

The model is loaded once when the server starts. If loading fails, the server still starts and `/health` returns HTTP 503 with the reason, so the frontend shows its "service isn't reachable" warning instead of failing silently.

`/detect` is a plain (synchronous) `def` endpoint. FastAPI runs it in a thread pool, so slow CPU inference does not block other requests.

## Consequences
- The backend runs with `uvicorn app.main:app` from the `backend/` folder.
- Settings (model path, thresholds, CORS origins, database path, upload limit) change through environment variables, not code edits. See the root README.
- Logic in `service.py`, `detector.py` and `history.py` does not import FastAPI, so it can be tested or reused (for example in a script or a notebook) without a web server.
