"""
Request handling that does not depend on FastAPI: validate an upload, run detection,
build the response and record it in the history. main.py only maps HTTP to these calls.
"""
import base64
import uuid
from collections import Counter
from datetime import datetime, timezone

import cv2
import numpy as np

from . import config
from .detector import WasteDetector
from .history import HistoryStore


class UploadError(Exception):
    """A problem with the uploaded file. `status` is the HTTP status code to return."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def validate_upload(data: bytes, content_type: str | None) -> None:
    if content_type not in config.ALLOWED_CONTENT_TYPES:
        raise UploadError(415, "Unsupported file type. Use a JPG, PNG or WEBP image.")
    if not data:
        raise UploadError(400, "The uploaded file is empty.")
    if len(data) > config.MAX_UPLOAD_MB * 1024 * 1024:
        raise UploadError(413, f"The image is larger than {config.MAX_UPLOAD_MB:g} MB.")


def decode_image(data: bytes) -> np.ndarray:
    """
    Decodes JPG/PNG/WEBP bytes into a BGR array. OpenCV applies the EXIF orientation,
    the same way browsers display the photo, so boxes line up with what the user sees.
    """
    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise UploadError(422, "The file could not be read as an image.")
    return image


def encode_annotated(image: np.ndarray, detections: list[dict]) -> str:
    """Draws boxes on a copy of the image and returns it as a base64 JPEG data URL."""
    canvas = image.copy()
    longest_side = max(canvas.shape[:2])
    thickness = max(2, round(longest_side / 400))
    font_scale = max(0.5, longest_side / 1600)
    box_color = (43, 61, 31)  # CleanSight forest green #1F3D2B, in BGR
    text_color = (244, 249, 251)  # ivory #FBF9F4, in BGR

    for det in detections:
        x1, y1, x2, y2 = det["bbox"]
        cv2.rectangle(canvas, (x1, y1), (x2, y2), box_color, thickness)

        # Label on a filled background so it stays readable on any photo.
        text = f"{det['label']} {round(det['confidence'] * 100)}%"
        (text_w, text_h), baseline = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness // 2 + 1)
        label_h = text_h + baseline + 2 * thickness
        label_y = y1 - label_h if y1 - label_h >= 0 else y1
        cv2.rectangle(canvas, (x1, label_y), (x1 + text_w + 2 * thickness, label_y + label_h), box_color, -1)
        cv2.putText(
            canvas,
            text,
            (x1 + thickness, label_y + text_h + thickness),
            cv2.FONT_HERSHEY_SIMPLEX,
            font_scale,
            text_color,
            thickness // 2 + 1,
            cv2.LINE_AA,
        )
    ok, buffer = cv2.imencode(".jpg", canvas, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok:
        return ""
    return "data:image/jpeg;base64," + base64.b64encode(buffer.tobytes()).decode("ascii")


def run_detection(
    detector: WasteDetector,
    history: HistoryStore | None,
    data: bytes,
    content_type: str | None,
    file_name: str | None,
    conf: float | None = None,
    annotate: bool = False,
    save: bool = True,
) -> dict:
    validate_upload(data, content_type)
    image = decode_image(data)
    height, width = image.shape[:2]

    conf_threshold = config.CONF_THRESHOLD if conf is None else conf
    detections = [d.to_dict() for d in detector.detect(image, conf_threshold, config.IOU_THRESHOLD)]
    counts = Counter(d["label"] for d in detections)

    result = {
        "id": uuid.uuid4().hex,
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "file_name": file_name,
        "image": {"width": width, "height": height},
        "total": len(detections),
        # Every model class is listed, so a class with zero detections shows up as 0.
        "counts": {name: counts.get(name, 0) for name in detector.class_names},
        "detections": detections,
        "saved": False,
    }
    if save and history is not None:
        history.add(result)
        result["saved"] = True
    if annotate:
        result["annotated_image"] = encode_annotated(image, detections)
    return result
