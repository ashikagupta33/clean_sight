"""
CleanSight FastAPI application.

Run from the backend/ folder:
    uvicorn app.main:app --reload --port 8000

Endpoints
    GET  /health               service and model status
    POST /detect               detect waste in one image (multipart field "file")
    GET  /history              recent scans, newest first
    GET  /history/{scan_id}    one scan with all its detections
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import config
from .detector import WasteDetector
from .history import HistoryStore
from .service import UploadError, run_detection

logger = logging.getLogger("cleansight")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the model once at startup. If it fails, the API still starts so /health
    # can report the problem instead of the server refusing every connection.
    app.state.detector = None
    app.state.model_error = None
    try:
        app.state.detector = WasteDetector(config.MODEL_PATH)
        logger.info("Model loaded from %s with classes %s", config.MODEL_PATH, app.state.detector.class_names)
    except Exception as exc:  # noqa: BLE001 - any load failure must be reported, not crash the app
        app.state.model_error = str(exc)
        logger.error("Model could not be loaded: %s", exc)

    app.state.history = HistoryStore(config.DB_PATH)
    yield
    app.state.history.close()


app = FastAPI(
    title="CleanSight API",
    description="AI-powered waste detection for public spaces (YOLOv8, ONNX Runtime).",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(UploadError)
async def upload_error_handler(request: Request, exc: UploadError):
    return JSONResponse(status_code=exc.status, content={"detail": exc.message})


@app.get("/health")
def health(request: Request):
    detector = request.app.state.detector
    if detector is None:
        # 503 makes the frontend show its "detection service isn't reachable" warning.
        return JSONResponse(
            status_code=503,
            content={"status": "error", "model_loaded": False, "detail": request.app.state.model_error},
        )
    return {
        "status": "ok",
        "model_loaded": True,
        "model": detector.model_path.name,
        "classes": detector.class_names,
        "scans_stored": request.app.state.history.count(),
    }


@app.post("/detect")
def detect(
    request: Request,
    file: UploadFile = File(..., description="JPG, PNG or WEBP image"),
    conf: float | None = Query(None, ge=0.0, le=1.0, description="Confidence threshold (default 0.25)"),
    annotate: bool = Query(False, description="Also return an annotated JPEG as a data URL"),
    save: bool = Query(True, description="Record this scan in the history"),
):
    # A plain `def` endpoint runs in FastAPI's thread pool, so CPU-bound inference
    # does not block other requests such as /health.
    detector = request.app.state.detector
    if detector is None:
        raise HTTPException(status_code=503, detail="The detection model is not loaded.")

    # Read at most one byte past the limit, so an oversized upload is rejected
    # without loading the whole file into memory.
    data = file.file.read(int(config.MAX_UPLOAD_MB * 1024 * 1024) + 1)
    return run_detection(
        detector,
        request.app.state.history,
        data=data,
        content_type=file.content_type,
        file_name=file.filename,
        conf=conf,
        annotate=annotate,
        save=save,
    )


@app.get("/history")
def list_history(request: Request, limit: int = Query(500, ge=1, le=5000)):
    return {"scans": request.app.state.history.list(limit)}


@app.get("/history/{scan_id}")
def get_scan(request: Request, scan_id: str):
    scan = request.app.state.history.get(scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found.")
    return scan
