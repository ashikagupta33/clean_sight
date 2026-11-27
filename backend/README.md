# CleanSight Backend

FastAPI service that runs the CleanSight waste detection model (YOLOv8s, ONNX Runtime on the CPU) and stores the scan history in SQLite.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- Health check: http://localhost:8000/health
- Interactive API docs: http://localhost:8000/docs

Endpoints, settings and troubleshooting are in the [root README](../README.md). The reasons behind the design are in [`decisions/`](../decisions/README.md).
