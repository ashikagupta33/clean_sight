# 002. Run the model with ONNX Runtime, not PyTorch

- **Date:** 2026-11-27
- **Status:** Accepted

## Context
The ML team trained YOLOv8s on 4 TACO classes and exported two files: `best.pt` (PyTorch, ~21 MB) and `best.onnx` (~43 MB). `ML/inference.py` uses the `ultralytics` package with `best.pt`, which pulls in PyTorch (around 2 GB installed). The brief warns that GPU inference may not be available on every hosting tier and recommends CPU-friendly options.

## Decision
The backend loads `best.onnx` with `onnxruntime` on the CPU. It does not depend on `ultralytics` or PyTorch.

Because `ultralytics` is not used, `app/detector.py` reproduces its prediction steps:

1. **Letterbox:** resize keeping the aspect ratio, pad to 640×640 with grey (114).
2. **Normalise:** BGR to RGB, divide by 255, HWC to CHW.
3. **Decode:** the output `[1, 8, 8400]` holds box centre x, centre y, width, height and 4 class scores per anchor. The best class per anchor is kept if its score is above the confidence threshold (default 0.25).
4. **NMS:** non-maximum suppression per class with IoU 0.7, the Ultralytics defaults.
5. **Map back:** remove the padding and divide by the resize gain, so boxes are in pixels of the original uploaded image.

Class names are read from the ONNX file's metadata (`bottle`, `can`, `paper_cardboard`, `plastic_wrapper`), so a retrained model with different classes works without code changes.

## How it was checked
- On the notebook's sample images, boxes land on the same objects and pixel positions as the Ultralytics predictions saved in the notebook.
- A synthetic test confirmed NMS removes duplicates of the same class, keeps overlapping boxes of different classes, and maps letterboxed coordinates back correctly.
- Inference took about 0.3 s per image (CPU only) on the machine used for testing.

## Consequences
- Small install, fast cold start, and runs on free CPU hosting.
- Confidence values can differ slightly from `model.predict()` on `best.pt`. Ultralytics pads `.pt` inputs only to a multiple of 32, while the ONNX model needs a full 640×640 square. Detected objects are the same in practice.
- If the model is re-exported, keep `imgsz=640` and the default (non end-to-end) head, or update `detector.py` to match.
- Licence note: Ultralytics YOLOv8 and models trained with it are under AGPL-3.0 (this is recorded in the ONNX metadata). This is fine for a university project; check the licence before any commercial use.
