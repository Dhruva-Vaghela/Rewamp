"""
Unit and Integration Tests for RAG Pipeline
"""

import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.rag.config import config
from backend.rag.extractor import PdfExtractor
from backend.rag.chunker import StructureAwareChunker
from backend.rag.embedder import embedder
from backend.rag.schemas import ChatRequest, Citation
from backend.rag.generator import generator

client = TestClient(app)

BOOKS_DIR = Path(__file__).resolve().parent.parent / "data" / "books"
ALICE_PDF = BOOKS_DIR / "alice-s-adventures-in-wonderland-lewis-carroll-9898.pdf"


def test_pdf_extractor_real_pdf():
    assert ALICE_PDF.exists(), f"Alice PDF not found at {ALICE_PDF}"
    extractor = PdfExtractor()
    doc = extractor.extract(book_id="alice-in-wonderland", pdf_path=ALICE_PDF)

    assert doc.has_text is True
    assert doc.is_scanned is False
    assert doc.total_pages > 0
    assert len(doc.pages) > 0
    # Page numbers are 1-indexed
    assert doc.pages[0].page_number == 1
    assert any("Alice" in p.text for p in doc.pages)


def test_pdf_extractor_nonexistent_pdf():
    extractor = PdfExtractor()
    doc = extractor.extract(book_id="fake-book", pdf_path=Path("/tmp/nonexistent_file_xyz.pdf"))
    assert doc.has_text is False
    assert doc.error is not None


def test_structure_aware_chunker():
    extractor = PdfExtractor()
    doc = extractor.extract(book_id="alice-in-wonderland", pdf_path=ALICE_PDF)
    chunker = StructureAwareChunker(target_chars=1000, overlap_chars=200)
    chunks = chunker.chunk_document(doc)

    assert len(chunks) > 5
    for chunk in chunks:
        assert chunk.book_id == "alice-in-wonderland"
        assert chunk.chunk_id.startswith("alice-in-wonderland_c")
        assert chunk.page_start >= 1
        assert chunk.page_end >= chunk.page_start
        assert chunk.char_count == len(chunk.text)
        assert chunk.token_count_est > 0


def test_chunk_id_determinism():
    extractor = PdfExtractor()
    doc = extractor.extract(book_id="alice-in-wonderland", pdf_path=ALICE_PDF)
    chunker = StructureAwareChunker(target_chars=1000, overlap_chars=200)
    chunks1 = chunker.chunk_document(doc)
    chunks2 = chunker.chunk_document(doc)

    assert len(chunks1) == len(chunks2)
    for c1, c2 in zip(chunks1, chunks2):
        assert c1.chunk_id == c2.chunk_id
        assert c1.page_start == c2.page_start


def test_embedder_dimension_and_consistency():
    q_vec = embedder.embed_query("Who went down the rabbit hole?")
    assert len(q_vec) == config.EMBEDDING_DIMENSION
    assert len(q_vec) == 384

    texts = ["Alice was beginning to get very tired of sitting by her sister.", "The White Rabbit checked his watch."]
    doc_vecs = embedder.embed_texts(texts)
    assert len(doc_vecs) == 2
    assert len(doc_vecs[0]) == 384
    assert len(doc_vecs[1]) == 384


def test_api_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["books_count"] >= 1
    assert "groq_configured" in data


def test_api_list_books():
    resp = client.get("/api/books")
    assert resp.status_code == 200
    books = resp.json()
    assert len(books) >= 1
    sample = books[0]
    assert "id" in sample
    assert "title" in sample
    assert "ingest_status" in sample


def test_api_rag_status():
    resp = client.get("/api/rag/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "dependencies" in data
    assert data["dependencies"]["embedding_model"] == config.EMBEDDING_MODEL_NAME


def test_chat_unregistered_or_uningested_book():
    # Attempting to chat with uningested book returns 400 with helpful instruction
    resp = client.post("/api/chat", json={"book_id": "non-existent-book-id", "question": "Hello?"})
    assert resp.status_code in (400, 404)
