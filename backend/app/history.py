"""
Scan history stored in SQLite.

Only numbers are stored (time, file name, counts, boxes). Uploaded images are never
written to disk, so the database stays small and no photos of people are kept.
"""
import json
import sqlite3
import threading
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS scans (
    id          TEXT PRIMARY KEY,
    timestamp   TEXT NOT NULL,           -- ISO 8601, UTC
    file_name   TEXT,
    width       INTEGER NOT NULL,
    height      INTEGER NOT NULL,
    total       INTEGER NOT NULL,
    counts      TEXT NOT NULL,           -- JSON object {model_label: count}
    detections  TEXT NOT NULL            -- JSON array of {label, confidence, bbox}
);
CREATE INDEX IF NOT EXISTS idx_scans_timestamp ON scans (timestamp);
"""


class HistoryStore:
    def __init__(self, db_path: Path):
        db_path = Path(db_path)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        # One connection shared by FastAPI's worker threads; the lock serialises access.
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        with self._lock:
            self._conn.executescript(SCHEMA)
            self._conn.commit()

    def add(self, scan: dict) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO scans (id, timestamp, file_name, width, height, total, counts, detections) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    scan["id"],
                    scan["timestamp"],
                    scan.get("file_name"),
                    scan["image"]["width"],
                    scan["image"]["height"],
                    scan["total"],
                    json.dumps(scan["counts"]),
                    json.dumps(scan["detections"]),
                ),
            )
            self._conn.commit()

    def list(self, limit: int) -> list[dict]:
        """Most recent scans first. Detections are left out to keep the response small."""
        with self._lock:
            rows = self._conn.execute(
                "SELECT id, timestamp, file_name, total, counts FROM scans ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [
            {
                "id": row["id"],
                "timestamp": row["timestamp"],
                "file_name": row["file_name"],
                "total": row["total"],
                "counts": json.loads(row["counts"]),
            }
            for row in rows
        ]

    def get(self, scan_id: str) -> dict | None:
        with self._lock:
            row = self._conn.execute("SELECT * FROM scans WHERE id = ?", (scan_id,)).fetchone()
        if row is None:
            return None
        return {
            "id": row["id"],
            "timestamp": row["timestamp"],
            "file_name": row["file_name"],
            "image": {"width": row["width"], "height": row["height"]},
            "total": row["total"],
            "counts": json.loads(row["counts"]),
            "detections": json.loads(row["detections"]),
        }

    def count(self) -> int:
        with self._lock:
            return self._conn.execute("SELECT COUNT(*) FROM scans").fetchone()[0]

    def close(self) -> None:
        with self._lock:
            self._conn.close()
