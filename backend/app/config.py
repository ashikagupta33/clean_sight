"""
Backend settings.

Every value can be overridden with an environment variable, so the same code runs
on a laptop, in a lab machine or on a hosting service without edits.
"""
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _float(name: str, default: float) -> float:
    return float(os.getenv(name, default))


def _list(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


# Path to the exported YOLOv8 ONNX model.
MODEL_PATH = Path(os.getenv("CLEANSIGHT_MODEL_PATH", BACKEND_DIR / "models" / "best.onnx"))

# Detections below this confidence are dropped. 0.25 matches the ML team's inference.py.
CONF_THRESHOLD = _float("CLEANSIGHT_CONF", 0.25)

# IoU threshold for non-maximum suppression. 0.7 is the Ultralytics default for predict().
IOU_THRESHOLD = _float("CLEANSIGHT_IOU", 0.7)

# SQLite file that stores the scan history (numbers only, never images).
DB_PATH = Path(os.getenv("CLEANSIGHT_DB_PATH", BACKEND_DIR / "data" / "cleansight.db"))

# Upload limits. They mirror frontend/js/config.js so both sides reject the same files.
MAX_UPLOAD_MB = _float("CLEANSIGHT_MAX_UPLOAD_MB", 10)
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}

# Browser origins allowed to call the API. Live Server and `python -m http.server 5500` use port 5500.
CORS_ORIGINS = _list(
    "CLEANSIGHT_CORS_ORIGINS",
    "http://localhost:5500,http://127.0.0.1:5500",
)
