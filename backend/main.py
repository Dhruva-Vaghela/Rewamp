"""
Rewamp Library – Backend API (Phase 1)
Provides: health check, book catalog, book detail, PDF serving, and real PDF cover generation/serving.
Does NOT implement: embeddings, Qdrant, RAG, LLM, or AI chat.
"""


from __future__ import annotations

import logging
import os
import re
import unicodedata
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

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
    """
    Extract a human-readable title and author from a PDF filename stem.

    Patterns handled:
      alice-s-adventures-in-wonderland-lewis-carroll-9898
      pride-and-prejudice-jane-austen
      frankenstein-mary-shelley
    """
    # Strip trailing numeric ID (e.g. -9898)
    stem = re.sub(r"-\d{4,}$", "", stem)

    # Known author last-name tokens that appear at the end of the stem.
    # We try to split off a "firstname-lastname" suffix.
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
            title_slug = stem[: -(len(slug) + 1)]  # drop trailing '-'
            title = title_slug.replace("-", " ").title()
            return title, full_name

    # Fallback: whole stem becomes title, no author
    title = stem.replace("-", " ").title()
    return title, None


def _get_pdf_metadata(pdf_path: Path) -> dict:
    """Return page_count and any metadata embedded in the PDF."""
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
    """
    Extract/render page 1 of the PDF into a high-quality cover thumbnail.
    Caches the generated image to COVERS_DIR/{book_id}.jpg.
    Re-uses the cached image if it is newer than the source PDF.
    Returns the path to the thumbnail, or None if extraction failed.
    """
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
            logger.warning("PDF has 0 pages: %s", pdf_path.name)
            doc.close()
            return None

        # Extract page 1
        page = doc[0]
        # Crisp rendering: 600px width preserves sharp artwork, typography, and detail
        target_width = 600.0
        scale = max(0.5, min(3.0, target_width / max(page.rect.width, 1.0)))
        matrix = pymupdf.Matrix(scale, scale)
        pix = page.get_pixmap(matrix=matrix, alpha=False)

        COVERS_DIR.mkdir(parents=True, exist_ok=True)
        # Atomic write to temporary file to avoid partially-written files
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

        # Prefer PDF-embedded metadata; fall back to filename parse
        title = (pdf_meta["pdf_title"] or filename_title).strip()
        author = (pdf_meta["pdf_author"] or filename_author or "Unknown Author").strip()

        books.append(
            {
                "id": book_id,
                "filename": pdf_file.name,
                "title": title,
                "author": author,
                "page_count": pdf_meta["page_count"],
                "size_bytes": pdf_file.stat().st_size,
                "cover_url": f"/api/books/{book_id}/cover",
            }
        )
    return books


# Dynamic catalog cache
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
        # Re-scan in case a new PDF was added to BOOKS_DIR
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


class BookDetail(BaseModel):
    id: str
    title: str
    author: str
    page_count: Optional[int]
    size_bytes: int
    filename: str
    cover_url: str


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Rewamp Library API",
    description="Phase 1 catalog, cover thumbnail generation, and PDF serving API. No AI/RAG endpoints.",
    version="0.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.on_event("startup")
def warmup_covers() -> None:
    """Pre-generate covers for all books on startup for instant library page load."""
    _reload_catalog()
    for book in _CATALOG:
        pdf_path = BOOKS_DIR / book["filename"]
        try:
            _ensure_cover(book["id"], pdf_path)
        except Exception as e:
            logger.warning("Cover pre-warm skipped for %s: %e", book["id"], e)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health", tags=["System"])
def health() -> dict:
    return {"status": "ok", "books_count": len(_CATALOG)}


@app.get("/api/books", response_model=list[BookSummary], tags=["Books"])
def list_books() -> list[dict]:
    """Return all books in the catalog. Dynamically picks up newly added PDFs."""
    # Always ensure up to date catalog
    return _reload_catalog()


@app.get("/api/books/{book_id}", response_model=BookDetail, tags=["Books"])
def get_book(book_id: str) -> dict:
    """Return metadata for a single book by ID."""
    book = _get_book_by_id(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@app.get("/api/books/{book_id}/cover", tags=["Books"])
def serve_cover(book_id: str) -> FileResponse:
    """
    Serve the front cover thumbnail rendered from page 1 of the PDF.
    Validates book_id strictly against the catalog — no arbitrary filesystem paths accepted.
    Returns HTTP 404 if the book ID is invalid or cover could not be extracted.
    """
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
        headers={
            "Cache-Control": "public, max-age=86400",
        },
    )


@app.get("/api/books/{book_id}/pdf", tags=["Books"])
def serve_pdf(book_id: str) -> FileResponse:
    """
    Serve the PDF file for a validated book ID.
    The book_id is checked against the catalog — no arbitrary path access.
    """
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

