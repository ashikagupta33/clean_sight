import cv2
from collections import Counter
from ultralytics import YOLO

# Load trained CleanSight model once at startup
MODEL_PATH = "best.pt"  # or "best.onnx" for CPU-only servers
model = YOLO(MODEL_PATH)

# Color map (BGR) for bounding boxes
COLORS = {
    "bottle": (255, 144, 30),          # Blue
    "can": (0, 215, 255),              # Yellow
    "paper_cardboard": (0, 200, 0),    # Green
    "plastic_wrapper": (0, 69, 255),   # Orange-Red
}

def detect_image(image_path: str, output_path: str = "annotated_output.jpg", conf_threshold: float = 0.25):
    """
    Runs litter detection on an image, saves annotated image with bounding boxes,
    and returns structured detections & counts for FastAPI POST /detect.
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image at {image_path}")

    results = model.predict(source=img, conf=conf_threshold, verbose=False)[0]
    
    detections = []
    counts = Counter()

    for box in results.boxes:
        cls_id = int(box.cls[0])
        cls_name = model.names[cls_id]
        confidence = round(float(box.conf[0]), 3)
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

        counts[cls_name] += 1
        detections.append({
            "class": cls_name,
            "confidence": confidence,
            "bbox": [x1, y1, x2, y2]
        })

        # Draw bounding box and label with OpenCV
        color = COLORS.get(cls_name, (255, 255, 255))
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
        label = f"{cls_name} {confidence:.2f}"
        cv2.putText(img, label, (x1, max(y1 - 8, 15)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    cv2.imwrite(output_path, img)

    return {
        "total_items": sum(counts.values()),
        "counts": dict(counts),
        "detections": detections,
        "annotated_image_path": output_path
    }

def analyze_video(video_path: str, output_path: str = "annotated_video.mp4", frame_skip: int = 5, conf_threshold: float = 0.25):
    """
    Processes short video for FastAPI POST /analyze-video.
    """
    cap = cv2.VideoCapture(video_path)
    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 24
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    out = cv2.VideoWriter(output_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height))
    frame_idx = 0
    max_counts_per_frame = Counter()

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % frame_skip == 0:
            results = model.predict(source=frame, conf=conf_threshold, verbose=False)[0]
            frame_counts = Counter()
            for box in results.boxes:
                cls_name = model.names[int(box.cls[0])]
                conf = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                frame_counts[cls_name] += 1
                color = COLORS.get(cls_name, (255, 255, 255))
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame, f"{cls_name} {conf:.2f}", (x1, max(y1 - 8, 15)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
            
            for k, v in frame_counts.items():
                max_counts_per_frame[k] = max(max_counts_per_frame[k], v)

        out.write(frame)
        frame_idx += 1

    cap.release()
    out.release()

    return {
        "peak_counts": dict(max_counts_per_frame),
        "annotated_video_path": output_path
    }
