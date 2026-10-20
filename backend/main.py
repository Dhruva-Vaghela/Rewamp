"""
Rewamp Library – Backend API
Phase 1: Catalog, cover thumbnail generation, and PDF serving.
Phase 2: RAG Pipeline with Qdrant Cloud, FastEmbed, and Groq LLM answer generation.
"""

from __future__ import annotations

import logging
import os
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .rag import config, ingestion_manager, rag_pipeline
from .rag.schemas import (
    BookIngestStatus,
    ChatRequest,
    ChatResponse,
    DependencyStatus,
    IngestJobProgress,
    IngestJobResponse,
    SystemHealthResponse,
)

logger = logging.getLogger("rewamp.api")
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BOOKS_DIR = Path(__file__).parent / "data" / "books"
COVERS_DIR = Path(__file__).parent / "data" / "covers"
COVERS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _slugify(text: str) -> str:
    """Return a URL-safe identifier from arbitrary text."""
    text = unicodedata.normalize("NFKD", text)
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", text)


def _parse_filename(stem: str) -> tuple[str, Optional[str]]:
    """Extract a human-readable title and author from a PDF filename stem."""
    stem = re.sub(r"-\d{4,}$", "", stem)

    known_authors: list[tuple[str, str]] = [
        ("lewis-carroll", "Lewis Carroll"),
        ("mary-shelley", "Mary Shelley"),
        ("george-macdonald", "George MacDonald"),
        ("jane-austen", "Jane Austen"),
        ("arthur-conan-doyle", "Arthur Conan Doyle"),
        ("f-scott-fitzgerald", "F. Scott Fitzgerald"),
        ("george-eliot", "George Eliot"),
        ("alexandre-dumas", "Alexandre Dumas"),
    ]

    for slug, full_name in known_authors:
        if stem.endswith(slug):
            title_slug = stem[: -(len(slug) + 1)]
            title = title_slug.replace("-", " ").title()
            return title, full_name

    title = stem.replace("-", " ").title()
    return title, None


def _get_pdf_metadata(pdf_path: Path) -> dict:
    """Return page_count and embedded PDF metadata."""
    try:
        from pypdf import PdfReader

        reader = PdfReader(str(pdf_path))
        page_count = len(reader.pages)
        info = reader.metadata or {}

        raw_title = info.get("/Title") or ""
        raw_author = info.get("/Author") or ""

        return {
            "page_count": page_count,
            "pdf_title": raw_title.strip() if raw_title else None,
            "pdf_author": raw_author.strip() if raw_author else None,
        }
    except Exception:
        return {"page_count": None, "pdf_title": None, "pdf_author": None}


def _ensure_cover(book_id: str, pdf_path: Path) -> Optional[Path]:
    """Render page 1 of PDF into cover thumbnail."""
    if not pdf_path.is_file():
        return None

    cover_path = COVERS_DIR / f"{book_id}.jpg"
    try:
        pdf_mtime = pdf_path.stat().st_mtime
        if cover_path.exists():
            cover_mtime = cover_path.stat().st_mtime
            if cover_mtime >= pdf_mtime and cover_path.stat().st_size > 0:
                return cover_path

        import pymupdf

        doc = pymupdf.open(str(pdf_path))
        if len(doc) == 0:
            doc.close()
            return None

        page = doc[0]
        target_width = 600.0
        scale = max(0.5, min(3.0, target_width / max(page.rect.width, 1.0)))
        matrix = pymupdf.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=matrix, alpha=False)

        COVERS_DIR.mkdir(parents=True, exist_ok=True)
        tmp_path = COVERS_DIR / f"{book_id}.tmp.jpg"
        pix.save(str(tmp_path), "jpg")
        tmp_path.replace(cover_path)
        doc.close()
        return cover_path
    except Exception as exc:
        logger.warning("Failed to render cover for '%s' (%s): %s", book_id, pdf_path.name, exc)
        return None


def _build_catalog() -> list[dict]:
    """Scan BOOKS_DIR and return a list of book metadata dicts."""
    books: list[dict] = []
    if not BOOKS_DIR.exists():
        return books

    for pdf_file in sorted(BOOKS_DIR.glob("*.pdf")):
        stem = pdf_file.stem
        book_id = _slugify(stem)
        filename_title, filename_author = _parse_filename(stem)
        pdf_meta = _get_pdf_metadata(pdf_file)

        title = (pdf_meta["pdf_title"] or filename_title).strip()
        author = (pdf_meta["pdf_author"] or filename_author or "Unknown Author").strip()

        # Ingestion status integration
        ingest_st = ingestion_manager.get_book_status(book_id, title)

        books.append(
            {
                "id": book_id,
                "filename": pdf_file.name,
                "title": title,
                "author": author,
                "page_count": pdf_meta["page_count"],
                "size_bytes": pdf_file.stat().st_size,
                "cover_url": f"/api/books/{book_id}/cover",
                "ingest_status": ingest_st.status,
                "chunk_count": ingest_st.chunk_count,
            }
        )
    return books


_CATALOG: list[dict] = []
_CATALOG_BY_ID: dict[str, dict] = {}


def _reload_catalog() -> list[dict]:
    global _CATALOG, _CATALOG_BY_ID
    _CATALOG = _build_catalog()
    _CATALOG_BY_ID = {b["id"]: b for b in _CATALOG}
    return _CATALOG


def _get_book_by_id(book_id: str) -> Optional[dict]:
    book = _CATALOG_BY_ID.get(book_id)
    if not book:
        _reload_catalog()
        book = _CATALOG_BY_ID.get(book_id)
    return book


# Initial population
_reload_catalog()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class BookSummary(BaseModel):
    id: str
    title: str
    author: str
    page_count: Optional[int]
    size_bytes: int
    cover_url: str
    ingest_status: Optional[str] = "pending"
    chunk_count: Optional[int] = 0


class BookDetail(BaseModel):
    id: str
    title: str
    author: str
    page_count: Optional[int]
    size_bytes: int
    filename: str
    cover_url: str
    ingest_status: Optional[str] = "pending"
    chunk_count: Optional[int] = 0


# ---------------------------------------------------------------------------
# App Definition & Middleware
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Rewamp Library API",
    description="Full-stack reading platform with Qdrant Cloud RAG and Groq LLM integration.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    """Pre-warm covers and verify RAG dependencies."""
    _reload_catalog()
    for book in _CATALOG:
        pdf_path = BOOKS_DIR / book["filename"]
        try:
            _ensure_cover(book["id"], pdf_path)
        except Exception as e:
            logger.warning("Cover pre-warm skipped for %s: %s", book["id"], e)


# ---------------------------------------------------------------------------
# Health & Status Routes
# ---------------------------------------------------------------------------

@app.get("/health", tags=["System"])
def health() -> dict:
    """System health check and RAG readiness."""
    qdrant_ok = False
    try:
        from .rag.vector_store import vector_store
        qc = vector_store.get_client()
        qdrant_ok = qc.collection_exists(config.QDRANT_COLLECTION_NAME)
    except Exception:
        qdrant_ok = False

    groq_ok = bool(config.GROQ_API_KEY)
    active_model = config.get_supported_groq_model() if groq_ok else "not_configured"
    ready_count = sum(1 for b in _CATALOG if ingestion_manager.is_book_ready(b["id"]))

    return {
        "status": "ok",
        "books_count": len(_CATALOG),
        "ready_books_count": ready_count,
        "qdrant_connected": qdrant_ok,
        "groq_configured": groq_ok,
        "active_model": active_model,
        "collection_name": config.QDRANT_COLLECTION_NAME,
    }


@app.get("/api/rag/status", response_model=SystemHealthResponse, tags=["RAG"])
def rag_status() -> SystemHealthResponse:
    """Detailed dependency and collection status."""
    qdrant_ok = False
    collection_ready = False
    try:
        from .rag.vector_store import vector_store
        qc = vector_store.get_client()
        collection_ready = qc.collection_exists(config.QDRANT_COLLECTION_NAME)
        qdrant_ok = True
    except Exception:
        qdrant_ok = False

    groq_ok = bool(config.GROQ_API_KEY)
    active_model = config.get_supported_groq_model() if groq_ok else "none"
    ready_count = sum(1 for b in _CATALOG if ingestion_manager.is_book_ready(b["id"]))

    return SystemHealthResponse(
        status="ok" if (qdrant_ok and groq_ok) else "degraded",
        books_count=len(_CATALOG),
        ready_books_count=ready_count,
        dependencies=DependencyStatus(
            qdrant=qdrant_ok,
            groq=groq_ok,
            collection_ready=collection_ready,
            active_model=active_model,
            embedding_model=config.EMBEDDING_MODEL_NAME,
        ),
    )


# ---------------------------------------------------------------------------
# Books Catalog Routes
# ---------------------------------------------------------------------------

@app.get("/api/books", response_model=list[BookSummary], tags=["Books"])
def list_books() -> list[dict]:
    """Return all books in the catalog with ingestion status."""
    return _reload_catalog()


@app.get("/api/books/{book_id}", response_model=BookDetail, tags=["Books"])
def get_book(book_id: str) -> dict:
    """Return metadata for a single book by ID."""
    book = _get_book_by_id(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    # Refresh status
    ingest_st = ingestion_manager.get_book_status(book_id, book["title"])
    book["ingest_status"] = ingest_st.status
    book["chunk_count"] = ingest_st.chunk_count
    return book


@app.get("/api/books/{book_id}/cover", tags=["Books"])
def serve_cover(book_id: str) -> FileResponse:
    """Serve the front cover thumbnail."""
    book = _get_book_by_id(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    pdf_path = BOOKS_DIR / book["filename"]
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found on disk")

    cover_path = _ensure_cover(book_id, pdf_path)
    if not cover_path or not cover_path.exists():
        raise HTTPException(status_code=404, detail="Could not render cover from PDF")

    return FileResponse(
        path=str(cover_path),
        media_type="image/jpeg",
        filename=f"{book_id}-cover.jpg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.get("/api/books/{book_id}/pdf", tags=["Books"])
def serve_pdf(book_id: str) -> FileResponse:
    """Serve the PDF file."""
    book = _get_book_by_id(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    pdf_path = BOOKS_DIR / book["filename"]
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF file not found on disk")

    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=book["filename"],
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "public, max-age=3600",
        },
    )


# ---------------------------------------------------------------------------
# Ingestion Routes
# ---------------------------------------------------------------------------

@app.get("/api/rag/books", response_model=List[BookIngestStatus], tags=["Ingestion"])
def list_ingestion_statuses() -> List[BookIngestStatus]:
    """Return ingestion status for all books."""
    _reload_catalog()
    return ingestion_manager.list_all_statuses(_CATALOG)


@app.get("/api/rag/books/{book_id}/status", response_model=BookIngestStatus, tags=["Ingestion"])
def get_book_ingest_status(book_id: str) -> BookIngestStatus:
    """Check ingestion status of a single book."""
    book = _get_book_by_id(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found in catalog")
    return ingestion_manager.get_book_status(book_id, book["title"])


@app.post("/api/rag/ingest/{book_id}", response_model=IngestJobResponse, tags=["Ingestion"])
def start_book_ingest(book_id: str) -> IngestJobResponse:
    """Start ingestion for a single book."""
    book = _get_book_by_id(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found in catalog")

    job_id = ingestion_manager.start_background_ingest([book])
    return IngestJobResponse(
        job_id=job_id,
        status="started",
        message=f"Ingestion started for '{book['title']}'.",
        book_id=book_id,
    )


@app.post("/api/rag/ingest-all", response_model=IngestJobResponse, tags=["Ingestion"])
def start_ingest_all() -> IngestJobResponse:
    """Start background ingestion for all books in catalog."""
    _reload_catalog()
    if not _CATALOG:
        raise HTTPException(status_code=400, detail="No books available to ingest")

    job_id = ingestion_manager.start_background_ingest(_CATALOG)
    return IngestJobResponse(
        job_id=job_id,
        status="started",
        message=f"Ingestion started for all {len(_CATALOG)} books.",
    )


@app.get("/api/rag/jobs/{job_id}", response_model=IngestJobProgress, tags=["Ingestion"])
def get_job_progress(job_id: str) -> IngestJobProgress:
    """Poll progress of an ingestion job."""
    job = ingestion_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Ingestion job not found")
    return job


# ---------------------------------------------------------------------------
# Chat & RAG Query Routes
# ---------------------------------------------------------------------------

@app.post("/api/chat", response_model=ChatResponse, tags=["Chat"])
def chat(request: ChatRequest) -> ChatResponse:
    """
    Ask a question about a specific book.
    Enforces book-level retrieval isolation and Groq-grounded answer generation.
    """
    book = _get_book_by_id(request.book_id)
    if not book:
        raise HTTPException(status_code=404, detail=f"Book '{request.book_id}' does not exist.")

    if not ingestion_manager.is_book_ready(request.book_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Book '{book['title']}' has not been ingested yet. Please ingest it before asking questions.",
        )

    try:
        response = rag_pipeline.answer_question(
            request=request,
            book_title=book["title"],
        )
        return response
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        logger.error("Chat error: %s", exc)
        # Safe user error message that does not expose internal secrets or paths
        err_msg = str(exc)
        if "api_key" in err_msg.lower():
            err_msg = "LLM provider authorization error. Check API credentials."
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {err_msg}")
