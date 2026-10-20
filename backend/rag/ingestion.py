"""
Ingestion Workflow Manager
Handles PDF content hashing, state persistence, background job processing,
and idempotent indexing into Qdrant Cloud.
"""

from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from .chunker import StructureAwareChunker
from .config import config
from .embedder import embedder
from .extractor import PdfExtractor
from .schemas import BookIngestStatus, IngestJobProgress
from .vector_store import vector_store

logger = logging.getLogger("rewamp.rag.ingestion")


def compute_file_hash(path: Path) -> str:
    """Calculate SHA256 hash of a file to detect content changes."""
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


class IngestionManager:
    """
    Orchestrates the ingestion pipeline and tracks status across all catalog books.
    Status states: 'pending', 'processing', 'ready', 'failed'.
    """

    _instance: Optional[IngestionManager] = None

    @classmethod
    def get_instance(cls) -> IngestionManager:
        if cls._instance is None:
            cls._instance = IngestionManager()
        return cls._instance

    def __init__(self) -> None:
        self.status_file = config.STATUS_FILE
        self.chunker = StructureAwareChunker()
        self.extractor = PdfExtractor()
        self._lock = threading.Lock()
        self._jobs: Dict[str, IngestJobProgress] = {}
        self._statuses: Dict[str, BookIngestStatus] = {}
        self._load_status()

    def _load_status(self) -> None:
        """Load stored ingestion status from disk if available."""
        if self.status_file.exists():
            try:
                with open(self.status_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for book_id, item in data.items():
                        self._statuses[book_id] = BookIngestStatus(**item)
            except Exception as exc:
                logger.warning("Could not read status file %s: %s", self.status_file, exc)

    def _save_status(self) -> None:
        """Persist current ingestion status to disk atomically."""
        try:
            self.status_file.parent.mkdir(parents=True, exist_ok=True)
            tmp_file = self.status_file.with_suffix(".tmp.json")
            with open(tmp_file, "w", encoding="utf-8") as f:
                raw = {k: v.model_dump() for k, v in self._statuses.items()}
                json.dump(raw, f, indent=2)
            tmp_file.replace(self.status_file)
        except Exception as exc:
            logger.error("Could not write status file %s: %s", self.status_file, exc)

    def get_book_status(self, book_id: str, title: str = "") -> BookIngestStatus:
        """Get or initialize status for a specific book."""
        with self._lock:
            if book_id in self._statuses:
                return self._statuses[book_id]
            # Check if vectors already exist in Qdrant
            chunk_count = vector_store.count_chunks_for_book(book_id)
            initial_status = "ready" if chunk_count > 0 else "pending"
            status = BookIngestStatus(
                book_id=book_id,
                title=title or book_id,
                status=initial_status,
                chunk_count=chunk_count,
            )
            self._statuses[book_id] = status
            self._save_status()
            return status

    def list_all_statuses(self, catalog_books: List[dict]) -> List[BookIngestStatus]:
        """Return the current ingestion status for all books in catalog."""
        results: List[BookIngestStatus] = []
        for book in catalog_books:
            b_id = book["id"]
            title = book.get("title", b_id)
            st = self.get_book_status(b_id, title)
            results.append(st)
        return results

    def is_book_ready(self, book_id: str) -> bool:
        """Returns True if the book has been successfully ingested."""
        st = self.get_book_status(book_id)
        if st.status == "ready" and st.chunk_count > 0:
            return True
        # Double check vector count
        count = vector_store.count_chunks_for_book(book_id)
        if count > 0:
            st.status = "ready"
            st.chunk_count = count
            self._save_status()
            return True
        return False

    def get_job(self, job_id: str) -> Optional[IngestJobProgress]:
        return self._jobs.get(job_id)

    def ingest_book_sync(self, book_id: str, pdf_path: Path, title: str = "") -> BookIngestStatus:
        """
        Executes ingestion for a single book.
        - Calculates file hash.
        - Skips re-embedding if unchanged and already ready.
        - Extracts text.
        - Chunks text.
        - Generates embeddings.
        - Upserts to Qdrant Cloud.
        """
        if not pdf_path.exists():
            st = BookIngestStatus(
                book_id=book_id,
                title=title or book_id,
                status="failed",
                error=f"PDF not found: {pdf_path.name}",
            )
            with self._lock:
                self._statuses[book_id] = st
                self._save_status()
            return st

        current_hash = compute_file_hash(pdf_path)

        with self._lock:
            existing = self._statuses.get(book_id)
            if (
                existing
                and existing.status == "ready"
                and existing.file_hash == current_hash
                and existing.chunk_count > 0
            ):
                logger.info("Book '%s' is already ingested with matching content hash. Skipping.", book_id)
                return existing

            # Set status to processing
            self._statuses[book_id] = BookIngestStatus(
                book_id=book_id,
                title=title or (existing.title if existing else book_id),
                status="processing",
                file_hash=current_hash,
                chunk_count=existing.chunk_count if existing else 0,
            )
            self._save_status()

        try:
            # 1. Text Extraction
            extracted_doc = self.extractor.extract(book_id=book_id, pdf_path=pdf_path)
            if not extracted_doc.has_text:
                err_msg = extracted_doc.error or "No text could be extracted from the document."
                raise ValueError(err_msg)

            # 2. Structure-Aware Chunking
            chunks = self.chunker.chunk_document(extracted_doc)
            if not chunks:
                raise ValueError("Chunking produced 0 chunks for document.")

            # 3. Embedding Generation
            texts = [c.text for c in chunks]
            vectors = embedder.embed_texts(texts)

            # 4. Qdrant Cloud Upsert
            # Clean previous vectors first to avoid dangling chunks if text shortened
            vector_store.delete_book_chunks(book_id)
            stored_count = vector_store.upsert_chunks(chunks, vectors)

            # 5. Mark as ready
            completed_status = BookIngestStatus(
                book_id=book_id,
                title=title or book_id,
                status="ready",
                chunk_count=stored_count,
                file_hash=current_hash,
                updated_at=datetime.now(timezone.utc).isoformat(),
            )
            with self._lock:
                self._statuses[book_id] = completed_status
                self._save_status()

            logger.info("Ingestion completed for '%s': %d vectors stored.", book_id, stored_count)
            return completed_status

        except Exception as exc:
            logger.error("Ingestion failed for book '%s': %s", book_id, exc)
            failed_status = BookIngestStatus(
                book_id=book_id,
                title=title or book_id,
                status="failed",
                error=str(exc),
                updated_at=datetime.now(timezone.utc).isoformat(),
            )
            with self._lock:
                self._statuses[book_id] = failed_status
                self._save_status()
            return failed_status

    def start_background_ingest(
        self,
        books_to_ingest: List[dict],
    ) -> str:
        """
        Starts an asynchronous background ingestion job for one or more books.
        Returns a job_id for progress polling.
        """
        job_id = str(uuid.uuid4())[:8]
        progress = IngestJobProgress(
            job_id=job_id,
            status="pending",
            total_books=len(books_to_ingest),
            processed_books=0,
        )
        self._jobs[job_id] = progress

        def _worker() -> None:
            progress.status = "running"
            for book in books_to_ingest:
                b_id = book["id"]
                title = book.get("title", b_id)
                pdf_path = config.BOOKS_DIR / book["filename"]
                progress.current_book = title

                result = self.ingest_book_sync(b_id, pdf_path, title)
                progress.processed_books += 1
                if result.status == "failed" and result.error:
                    progress.errors.append(f"{title}: {result.error}")

            progress.status = "completed" if not progress.errors else "completed_with_errors"
            progress.completed_at = datetime.now(timezone.utc).isoformat()
            progress.current_book = None

        thread = threading.Thread(target=_worker, daemon=True)
        thread.start()
        return job_id


ingestion_manager = IngestionManager.get_instance()
