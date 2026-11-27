"""
YOLOv8 waste detector running on ONNX Runtime (CPU).

This reproduces what Ultralytics does in `model.predict()` without needing PyTorch:
letterbox resize -> forward pass -> decode -> class-wise NMS -> map boxes back to the
original image. Boxes are returned in pixels of the ORIGINAL uploaded image, which is
what the frontend expects (RESPONSE_MAP.boxUnits = "pixels", boxFormat = "xyxy").
"""
import ast
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

# Used only if the ONNX file has no class names in its metadata.
FALLBACK_CLASS_NAMES = ["bottle", "can", "paper_cardboard", "plastic_wrapper"]

# Grey padding value used by Ultralytics when letterboxing.
PAD_VALUE = 114

# Upper bound on boxes kept per image, same as the Ultralytics default (max_det=300).
MAX_DETECTIONS = 300


@dataclass
class Detection:
    label: str
    confidence: float
    bbox: list[int]  # [x1, y1, x2, y2] in original-image pixels

    def to_dict(self) -> dict:
        return {"label": self.label, "confidence": self.confidence, "bbox": self.bbox}


class WasteDetector:
    def __init__(self, model_path: Path):
        if not Path(model_path).is_file():
            raise FileNotFoundError(f"Model file not found: {model_path}")

        self.session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        model_input = self.session.get_inputs()[0]
        self.input_name = model_input.name
        # Input shape is [batch, channels, height, width], e.g. [1, 3, 640, 640].
        self.input_height, self.input_width = int(model_input.shape[2]), int(model_input.shape[3])
        self.class_names = self._read_class_names()
        self.model_path = Path(model_path)

    def _read_class_names(self) -> list[str]:
        """Ultralytics stores names as a dict literal string, e.g. "{0: 'bottle', 1: 'can'}"."""
        raw = self.session.get_modelmeta().custom_metadata_map.get("names")
        if not raw:
            return list(FALLBACK_CLASS_NAMES)
        names = ast.literal_eval(raw)
        return [names[i] for i in sorted(names)]

    # ------------------------------------------------------------------ preprocessing

    def _letterbox(self, image: np.ndarray) -> tuple[np.ndarray, float, tuple[float, float]]:
        """Resize keeping the aspect ratio, then pad to the model's input size."""
        height, width = image.shape[:2]
        gain = min(self.input_height / height, self.input_width / width)
        new_w, new_h = round(width * gain), round(height * gain)
        pad_x = (self.input_width - new_w) / 2
        pad_y = (self.input_height - new_h) / 2

        resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        top, bottom = round(pad_y - 0.1), round(pad_y + 0.1)
        left, right = round(pad_x - 0.1), round(pad_x + 0.1)
        padded = cv2.copyMakeBorder(
            resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(PAD_VALUE,) * 3
        )
        return padded, gain, (left, top)

    def _to_tensor(self, image_bgr: np.ndarray) -> np.ndarray:
        rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        tensor = rgb.astype(np.float32) / 255.0
        return np.ascontiguousarray(tensor.transpose(2, 0, 1)[np.newaxis])  # HWC -> 1xCxHxW

    # ------------------------------------------------------------------ inference

    def detect(self, image_bgr: np.ndarray, conf_threshold: float, iou_threshold: float) -> list[Detection]:
        height, width = image_bgr.shape[:2]
        padded, gain, (pad_left, pad_top) = self._letterbox(image_bgr)
        output = self.session.run(None, {self.input_name: self._to_tensor(padded)})[0]
        return decode_output(
            output,
            class_names=self.class_names,
            conf_threshold=conf_threshold,
            iou_threshold=iou_threshold,
            gain=gain,
            pad=(pad_left, pad_top),
            image_size=(width, height),
        )


# ---------------------------------------------------------------------- postprocessing
# Kept as plain functions so they can be checked with synthetic arrays, without a model.


def decode_output(
    output: np.ndarray,
    class_names: list[str],
    conf_threshold: float,
    iou_threshold: float,
    gain: float,
    pad: tuple[float, float],
    image_size: tuple[int, int],
) -> list[Detection]:
    """
    Turns the raw YOLOv8 output of shape [1, 4 + num_classes, num_anchors] into detections.
    Rows 0-3 are box centre x, centre y, width, height in letterboxed pixels;
    the remaining rows are per-class scores (already sigmoid-activated).
    """
    predictions = output[0].T  # [num_anchors, 4 + num_classes]
    scores_all = predictions[:, 4:]
    class_ids = scores_all.argmax(axis=1)
    scores = scores_all[np.arange(len(class_ids)), class_ids]

    keep = scores > conf_threshold
    if not keep.any():
        return []
    boxes = _cxcywh_to_xyxy(predictions[keep, :4])
    scores, class_ids = scores[keep], class_ids[keep]

    kept = class_wise_nms(boxes, scores, class_ids, iou_threshold)[:MAX_DETECTIONS]

    # Undo the letterbox: remove padding, divide by the resize gain, clip to the image.
    width, height = image_size
    boxes = boxes[kept]
    boxes[:, [0, 2]] = (boxes[:, [0, 2]] - pad[0]) / gain
    boxes[:, [1, 3]] = (boxes[:, [1, 3]] - pad[1]) / gain
    boxes[:, [0, 2]] = boxes[:, [0, 2]].clip(0, width)
    boxes[:, [1, 3]] = boxes[:, [1, 3]].clip(0, height)

    return [
        Detection(
            label=class_names[int(class_id)] if int(class_id) < len(class_names) else f"class_{int(class_id)}",
            confidence=round(float(score), 3),
            bbox=[int(round(v)) for v in box],
        )
        for box, score, class_id in zip(boxes, scores[kept], class_ids[kept])
    ]


def _cxcywh_to_xyxy(boxes: np.ndarray) -> np.ndarray:
    out = np.empty_like(boxes)
    out[:, 0] = boxes[:, 0] - boxes[:, 2] / 2
    out[:, 1] = boxes[:, 1] - boxes[:, 3] / 2
    out[:, 2] = boxes[:, 0] + boxes[:, 2] / 2
    out[:, 3] = boxes[:, 1] + boxes[:, 3] / 2
    return out


def class_wise_nms(boxes: np.ndarray, scores: np.ndarray, class_ids: np.ndarray, iou_threshold: float) -> np.ndarray:
    """
    Non-maximum suppression applied separately per class (Ultralytics default, agnostic=False).
    Shifting each class's boxes by a large class-dependent offset lets one NMS pass do it.
    Returns indices sorted by descending score.
    """
    offset = class_ids[:, None].astype(np.float32) * (float(boxes.max()) + 1.0)
    return nms(boxes + offset, scores, iou_threshold)


def nms(boxes: np.ndarray, scores: np.ndarray, iou_threshold: float) -> np.ndarray:
    x1, y1, x2, y2 = boxes.T
    areas = (x2 - x1).clip(0) * (y2 - y1).clip(0)
    order = scores.argsort()[::-1]
    keep = []
    while order.size:
        best = order[0]
        keep.append(best)
        rest = order[1:]
        inter_w = (np.minimum(x2[best], x2[rest]) - np.maximum(x1[best], x1[rest])).clip(0)
        inter_h = (np.minimum(y2[best], y2[rest]) - np.maximum(y1[best], y1[rest])).clip(0)
        inter = inter_w * inter_h
        iou = inter / (areas[best] + areas[rest] - inter + 1e-9)
        order = rest[iou <= iou_threshold]
    return np.array(keep, dtype=np.int64)
