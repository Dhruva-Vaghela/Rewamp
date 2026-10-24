"""
Ingestion Workflow Manager
Handles PDF content hashing, state persistence via SQLite state_store, background job processing,
and safe versioned indexing into Qdrant Cloud without downtime.
"""

from __future__ import annotations

import hashlib
import logging
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from .chunker import StructureAwareChunker
from .config import config
from .embedder import embedder
from .extractor import PdfExtractor
from .schemas import BookIngestStatus, IngestJobProgress
from .state_store import state_store
from .vector_store import vector_store

logger = logging.getLogger("rewamp.rag.ingestion")


def compute_file_hash(path: Path) -> str:
    """Calculate SHA256 hash of a file to detect content changes."""
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def compute_config_hash() -> str:
    """Calculate hash of chunking and embedding configuration."""
    raw = (
        f"{config.EMBEDDING_MODEL_NAME}:"
        f"{config.CHUNK_TARGET_TOKENS}:"
        f"{config.CHUNK_OVERLAP_TOKENS}:"
        f"{config.CHUNK_MAX_TOKENS}"
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


class IngestionManager:
    """
    Orchestrates the ingestion pipeline and tracks status across all catalog books.
    Enforces safe versioned indexing: new points are uploaded and validated before
    marking the new version active and pruning older vectors.
    """

    _instance: Optional[IngestionManager] = None

    @classmethod
    def get_instance(cls) -> IngestionManager:
        if cls._instance is None:
            cls._instance = IngestionManager()
        return cls._instance

    def __init__(self) -> None:
        self.chunker = StructureAwareChunker()
        self.extractor = PdfExtractor()
        self.state_store = state_store
        self._lock = threading.Lock()

    def get_book_status(self, book_id: str, title: str = "") -> BookIngestStatus:
        """Get or initialize status for a specific book."""
        status = self.state_store.get_book_status(book_id)
        if status is not None:
            return status

        # Check if vectors already exist in Qdrant (legacy or pre-existing)
        chunk_count = vector_store.count_chunks_for_book(book_id)
        initial_status = "ready" if chunk_count > 0 else "pending"
        new_status = BookIngestStatus(
            book_id=book_id,
            title=title or book_id,
            status=initial_status,
            chunk_count=chunk_count,
            active_version=1 if chunk_count > 0 else None,
            updated_at=datetime.now(timezone.utc).isoformat(),
        )
        self.state_store.set_book_status(new_status)
        return new_status

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
        """Returns True if the book has been successfully ingested and has vectors."""
        st = self.get_book_status(book_id)
        if st.status == "ready" and st.chunk_count > 0:
            return True
        count = vector_store.count_chunks_for_book(book_id)
        if count > 0:
            st.status = "ready"
            st.chunk_count = count
            self.state_store.set_book_status(st)
            return True
        return False

    def get_job(self, job_id: str) -> Optional[IngestJobProgress]:
        return self.state_store.get_job(job_id)

    def ingest_book_sync(self, book_id: str, pdf_path: Path, title: str = "") -> BookIngestStatus:
        """
        Executes safe, versioned ingestion for a single book.
        - Checks file and config hash for idempotent skip.
        - Chunks and embeds text.
        - Uploads new version to Qdrant without deleting active vectors.
        - Validates all new points in Qdrant.
        - Switches active version atomically.
        - Safely cleans up superseded versions.
        """
        if not pdf_path.exists():
            st = BookIngestStatus(
                book_id=book_id,
                title=title or book_id,
                status="failed",
                error=f"PDF not found: {pdf_path.name}",
                updated_at=datetime.now(timezone.utc).isoformat(),
            )
            self.state_store.set_book_status(st)
            return st

        current_file_hash = compute_file_hash(pdf_path)
        current_conf_hash = compute_config_hash()

        with self._lock:
            existing = self.get_book_status(book_id, title)
            if existing and existing.status == "processing":
                raise RuntimeError(f"Book '{book_id}' is already being processed by another ingestion task.")

            # Idempotent skip if both source content and chunking/embedding config are unchanged
            if (
                existing
                and existing.status == "ready"
                and existing.file_hash == current_file_hash
                and existing.config_hash == current_conf_hash
                and existing.chunk_count > 0
            ):
                logger.info("Book '%s' is up-to-date (matching content and config hash). Skipping.", book_id)
                return existing

            next_version = (existing.active_version or 1) + 1 if existing and existing.active_version else 2

            # Mark status as processing while preserving active_version so live queries still work
            processing_status = BookIngestStatus(
                book_id=book_id,
                title=title or existing.title,
                status="processing",
                active_version=existing.active_version,
                chunk_count=existing.chunk_count,
                file_hash=current_file_hash,
                config_hash=current_conf_hash,
                updated_at=datetime.now(timezone.utc).isoformat(),
            )
            self.state_store.set_book_status(processing_status)

        try:
            # 1. Text Extraction
            extracted_doc = self.extractor.extract(book_id=book_id, pdf_path=pdf_path)
            if not extracted_doc.has_text:
                err_msg = extracted_doc.error or "No text could be extracted from the document."
                raise ValueError(err_msg)

            # 2. Token-Aware Chunking
            chunks = self.chunker.chunk_document(extracted_doc)
            if not chunks:
                raise ValueError("Chunking produced 0 chunks for document.")

            # 3. Dense Embedding Generation
            texts = [c.text for c in chunks]
            vectors = embedder.embed_texts(texts)

            # 4. Versioned Upsert into Qdrant (Old vectors remain live!)
            stored_count = vector_store.upsert_chunks(
                chunks=chunks,
                vectors=vectors,
                version=next_version,
                source_hash=current_file_hash,
                config_hash=current_conf_hash,
            )

            # 5. Strict Validation: confirm all vectors for next_version landed in Qdrant
            is_valid = vector_store.validate_version(
                book_id=book_id,
                version=next_version,
                expected_count=len(chunks),
            )
            if not is_valid:
                raise RuntimeError(
                    f"Vector validation failed: expected {len(chunks)} chunks for version {next_version}"
                )

            # 6. Atomically set new active version to ready in state store FIRST
            ready_status = BookIngestStatus(
                book_id=book_id,
                title=title or book_id,
                status="ready",
                active_version=next_version,
                chunk_count=stored_count,
                file_hash=current_file_hash,
                config_hash=current_conf_hash,
                updated_at=datetime.now(timezone.utc).isoformat(),
            )
            self.state_store.set_book_status(ready_status)

            # 7. Safely prune superseded versions only after activation succeeds
            vector_store.cleanup_old_versions(book_id=book_id, active_version=next_version)

            # 8. Invalidate query cache for this book
            from .generator import generator
            generator.cache.clear_book(book_id)

            logger.info(
                "Ingestion successfully validated for '%s': version %d active (%d chunks).",
                book_id,
                next_version,
                stored_count,
            )
            return ready_status

        except Exception as exc:
            logger.error("Ingestion failed for book '%s' (version %d): %s", book_id, next_version, exc)
            # Remove partial upload for failed version so it does not linger
            try:
                vector_store.delete_book_chunks(book_id, version=next_version)
            except Exception as del_exc:
                logger.warning("Could not clean failed version %d: %s", next_version, del_exc)

            # If book previously had valid active vectors, revert to ready status
            fallback_status = "ready" if (existing and existing.chunk_count > 0) else "failed"
            error_status = BookIngestStatus(
                book_id=book_id,
                title=title or book_id,
                status=fallback_status,
                active_version=existing.active_version if existing else None,
                chunk_count=existing.chunk_count if existing else 0,
                file_hash=existing.file_hash if existing else None,
                config_hash=existing.config_hash if existing else None,
                error=str(exc),
                updated_at=datetime.now(timezone.utc).isoformat(),
            )
            self.state_store.set_book_status(error_status)
            return error_status

    def start_background_ingest(self, books_to_ingest: List[dict]) -> str:
        """
        Starts an asynchronous background ingestion job with persistent state tracking.
        Detects and returns existing active job if already running.
        """
        # If single book, check if job is already active for it
        if len(books_to_ingest) == 1:
            active_job_id = self.state_store.is_active_job_running_for_book(books_to_ingest[0]["id"])
            if active_job_id:
                logger.info("Reusing already active job %s for book %s", active_job_id, books_to_ingest[0]["id"])
                return active_job_id

        job_id = str(uuid.uuid4())[:8]
        progress = self.state_store.create_job(job_id=job_id, total_books=len(books_to_ingest))

        def _worker() -> None:
            progress.status = "running"
            self.state_store.update_job(progress)

            for book in books_to_ingest:
                b_id = book["id"]
                title = book.get("title", b_id)
                pdf_path = config.BOOKS_DIR / book["filename"]
                progress.current_book = b_id
                self.state_store.update_job(progress)

                result = self.ingest_book_sync(b_id, pdf_path, title)
                progress.processed_books += 1
                if result.status == "failed" and result.error:
                    progress.errors.append(f"{title}: {result.error}")
                self.state_store.update_job(progress)

            progress.status = "completed" if not progress.errors else "completed_with_errors"
            progress.completed_at = datetime.now(timezone.utc).isoformat()
            progress.current_book = None
            self.state_store.update_job(progress)

        thread = threading.Thread(target=_worker, daemon=True)
        thread.start()
        return job_id


ingestion_manager = IngestionManager.get_instance()
