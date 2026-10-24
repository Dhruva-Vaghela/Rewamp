"""
Persistent SQLite State Store for RAG Ingestion & Jobs
Tracks book ingestion versions, source hashes, config hashes, and async background job lifecycle.
Recovers gracefully across process restarts and prevents duplicate concurrent runs.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from .config import config
from .schemas import BookIngestStatus, IngestJobProgress

logger = logging.getLogger("rewamp.rag.state_store")


class StateStore:
    """Manages persistent SQLite storage for book states and ingestion jobs."""

    _instance: Optional[StateStore] = None

    @classmethod
    def get_instance(cls) -> StateStore:
        if cls._instance is None:
            cls._instance = StateStore()
        return cls._instance

    def __init__(self, db_path: Optional[Path] = None) -> None:
        self.db_path = db_path or (config.DATA_DIR / "rag_state.db")
        self.status_file = config.STATUS_FILE
        self._lock = threading.Lock()
        self._init_db()
        self._bootstrap_from_json()
        self._recover_stale_jobs()

    def _get_connection(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(self.db_path), timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        return conn

    def _init_db(self) -> None:
        with self._lock, self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS book_status (
                    book_id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL,
                    active_version INTEGER,
                    chunk_count INTEGER DEFAULT 0,
                    file_hash TEXT,
                    config_hash TEXT,
                    error TEXT,
                    updated_at TEXT
                );
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS ingest_jobs (
                    job_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    total_books INTEGER NOT NULL,
                    processed_books INTEGER DEFAULT 0,
                    current_book TEXT,
                    errors TEXT,
                    created_at TEXT NOT NULL,
                    completed_at TEXT
                );
                """
            )
            conn.commit()

    def _bootstrap_from_json(self) -> None:
        """If database is empty, seed from existing ingestion_status.json."""
        with self._lock, self._get_connection() as conn:
            cur = conn.cursor()
            count = cur.execute("SELECT COUNT(*) FROM book_status").fetchone()[0]
            if count == 0 and self.status_file.exists():
                try:
                    with open(self.status_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    for b_id, item in data.items():
                        cur.execute(
                            """
                            INSERT OR REPLACE INTO book_status (
                                book_id, title, status, active_version, chunk_count, file_hash, config_hash, error, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (
                                b_id,
                                item.get("title", b_id),
                                item.get("status", "pending"),
                                item.get("active_version"),
                                item.get("chunk_count", 0),
                                item.get("file_hash"),
                                item.get("config_hash"),
                                item.get("error"),
                                item.get("updated_at"),
                            ),
                        )
                    conn.commit()
                    logger.info("Bootstrapped %d book records into SQLite state store from JSON", len(data))
                except Exception as exc:
                    logger.warning("Failed to bootstrap state store from %s: %s", self.status_file, exc)

    def _recover_stale_jobs(self) -> None:
        """Mark any unfinished jobs from prior crashed/restarted processes as failed."""
        with self._lock, self._get_connection() as conn:
            # 1. Recover stale jobs
            conn.execute(
                """
                UPDATE ingest_jobs
                SET status = 'failed',
                    errors = '["Process restarted while job was in progress"]',
                    completed_at = ?
                WHERE status IN ('pending', 'running')
                """,
                (datetime.now(timezone.utc).isoformat(),),
            )
            # 2. Reset books stuck in processing
            conn.execute(
                """
                UPDATE book_status
                SET status = CASE WHEN chunk_count > 0 THEN 'ready' ELSE 'failed' END,
                    error = 'Interrupted by process restart',
                    updated_at = ?
                WHERE status = 'processing'
                """,
                (datetime.now(timezone.utc).isoformat(),),
            )
            conn.commit()

    def get_book_status(self, book_id: str) -> Optional[BookIngestStatus]:
        with self._lock, self._get_connection() as conn:
            row = conn.execute("SELECT * FROM book_status WHERE book_id = ?", (book_id,)).fetchone()
            if not row:
                return None
            return BookIngestStatus(
                book_id=row["book_id"],
                title=row["title"],
                status=row["status"],
                active_version=row["active_version"],
                chunk_count=row["chunk_count"],
                file_hash=row["file_hash"],
                config_hash=row["config_hash"],
                error=row["error"],
                updated_at=row["updated_at"],
            )

    def set_book_status(self, status: BookIngestStatus) -> None:
        with self._lock:
            with self._get_connection() as conn:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO book_status (
                        book_id, title, status, active_version, chunk_count, file_hash, config_hash, error, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        status.book_id,
                        status.title,
                        status.status,
                        status.active_version,
                        status.chunk_count,
                        status.file_hash,
                        status.config_hash,
                        status.error,
                        status.updated_at or datetime.now(timezone.utc).isoformat(),
                    ),
                )
                conn.commit()
            self._sync_json_unlocked()

    def list_all_book_statuses(self) -> Dict[str, BookIngestStatus]:
        with self._lock, self._get_connection() as conn:
            rows = conn.execute("SELECT * FROM book_status").fetchall()
            results = {}
            for r in rows:
                results[r["book_id"]] = BookIngestStatus(
                    book_id=r["book_id"],
                    title=r["title"],
                    status=r["status"],
                    active_version=r["active_version"],
                    chunk_count=r["chunk_count"],
                    file_hash=r["file_hash"],
                    config_hash=r["config_hash"],
                    error=r["error"],
                    updated_at=r["updated_at"],
                )
            return results

    def _sync_json_unlocked(self) -> None:
        """Atomic write to ingestion_status.json for compatibility."""
        try:
            with self._get_connection() as conn:
                rows = conn.execute("SELECT * FROM book_status").fetchall()
                data = {
                    r["book_id"]: {
                        "book_id": r["book_id"],
                        "title": r["title"],
                        "status": r["status"],
                        "active_version": r["active_version"],
                        "chunk_count": r["chunk_count"],
                        "file_hash": r["file_hash"],
                        "config_hash": r["config_hash"],
                        "error": r["error"],
                        "updated_at": r["updated_at"],
                    }
                    for r in rows
                }
            self.status_file.parent.mkdir(parents=True, exist_ok=True)
            tmp_file = self.status_file.with_suffix(".tmp.json")
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            tmp_file.replace(self.status_file)
        except Exception as exc:
            logger.warning("Failed to sync status JSON: %s", exc)

    # --- Job Operations ---

    def create_job(self, job_id: str, total_books: int) -> IngestJobProgress:
        progress = IngestJobProgress(
            job_id=job_id,
            status="pending",
            total_books=total_books,
            processed_books=0,
            errors=[],
        )
        with self._lock, self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO ingest_jobs (
                    job_id, status, total_books, processed_books, current_book, errors, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    progress.job_id,
                    progress.status,
                    progress.total_books,
                    progress.processed_books,
                    progress.current_book,
                    json.dumps(progress.errors),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            conn.commit()
        return progress

    def update_job(self, progress: IngestJobProgress) -> None:
        with self._lock, self._get_connection() as conn:
            conn.execute(
                """
                UPDATE ingest_jobs
                SET status = ?,
                    total_books = ?,
                    processed_books = ?,
                    current_book = ?,
                    errors = ?,
                    completed_at = ?
                WHERE job_id = ?
                """,
                (
                    progress.status,
                    progress.total_books,
                    progress.processed_books,
                    progress.current_book,
                    json.dumps(progress.errors),
                    progress.completed_at,
                    progress.job_id,
                ),
            )
            conn.commit()

    def get_job(self, job_id: str) -> Optional[IngestJobProgress]:
        with self._lock, self._get_connection() as conn:
            row = conn.execute("SELECT * FROM ingest_jobs WHERE job_id = ?", (job_id,)).fetchone()
            if not row:
                return None
            errors = json.loads(row["errors"]) if row["errors"] else []
            return IngestJobProgress(
                job_id=row["job_id"],
                status=row["status"],
                total_books=row["total_books"],
                processed_books=row["processed_books"],
                current_book=row["current_book"],
                errors=errors,
                completed_at=row["completed_at"],
            )

    def is_active_job_running_for_book(self, book_id: str) -> Optional[str]:
        """Returns active job_id if an ingestion job is currently running on this book."""
        with self._lock, self._get_connection() as conn:
            row = conn.execute(
                """
                SELECT job_id FROM ingest_jobs
                WHERE status IN ('pending', 'running') AND current_book = ?
                """,
                (book_id,),
            ).fetchone()
            if row:
                return row["job_id"]
            return None


state_store = StateStore.get_instance()
