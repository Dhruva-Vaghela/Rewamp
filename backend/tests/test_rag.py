"""
Unit and Integration Tests for RAG Pipeline
Covers:
- Token-aware chunking and zero embedding truncation
- Deterministic chunk and point IDs
- Safe versioned indexing and SQLite state persistence
- Dense + hybrid retrieval, candidate deduplication, and active-version filtering
- Cross-book isolation and negative query evidence evaluation
- Citation validation and non-fabrication
- Actual token accounting, context budgeting, and query caching
- API contracts and diagnostics
"""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.rag.config import config
from backend.rag.extractor import PdfExtractor
from backend.rag.chunker import StructureAwareChunker
from backend.rag.embedder import embedder
from backend.rag.schemas import ChatRequest, Citation
from backend.rag.generator import generator
from backend.rag.retriever import retriever
from backend.rag.pipeline import rag_pipeline
from backend.rag.state_store import state_store
from backend.rag.vector_store import vector_store

client = TestClient(app)

BOOKS_DIR = Path(__file__).resolve().parent.parent / "data" / "books"
ALICE_PDF = BOOKS_DIR / "alice-s-adventures-in-wonderland-lewis-carroll-9898.pdf"
ALICE_BOOK_ID = "alice-s-adventures-in-wonderland-lewis-carroll-9898"


# ---------------------------------------------------------------------------
# Extractor Tests
# ---------------------------------------------------------------------------

def test_pdf_extractor_real_pdf():
    assert ALICE_PDF.exists(), f"Alice PDF not found at {ALICE_PDF}"
    extractor = PdfExtractor()
    doc = extractor.extract(book_id="alice-in-wonderland", pdf_path=ALICE_PDF)

    assert doc.has_text is True
    assert doc.is_scanned is False
    assert doc.total_pages > 0
    assert len(doc.pages) > 0
    assert doc.pages[0].page_number == 1
    assert any("Alice" in p.text for p in doc.pages)


def test_pdf_extractor_nonexistent_pdf():
    extractor = PdfExtractor()
    doc = extractor.extract(book_id="fake-book", pdf_path=Path("/tmp/nonexistent_file_xyz.pdf"))
    assert doc.has_text is False
    assert doc.error is not None


# ---------------------------------------------------------------------------
# Token-Aware Chunker Tests
# ---------------------------------------------------------------------------

def test_structure_aware_chunker():
    extractor = PdfExtractor()
    doc = extractor.extract(book_id="alice-in-wonderland", pdf_path=ALICE_PDF)
    chunker = StructureAwareChunker(target_tokens=300, overlap_tokens=50, max_tokens=450)
    chunks = chunker.chunk_document(doc)

    assert len(chunks) > 5
    for chunk in chunks:
        assert chunk.book_id == "alice-in-wonderland"
        assert chunk.chunk_id.startswith("alice-in-wonderland_c")
        assert chunk.page_start >= 1
        assert chunk.page_end >= chunk.page_start
        assert chunk.char_count == len(chunk.text)
        assert chunk.token_count > 0
        assert chunk.token_count <= 490, f"Chunk {chunk.chunk_id} exceeded max token limit!"


def test_chunk_id_determinism():
    extractor = PdfExtractor()
    doc = extractor.extract(book_id="alice-in-wonderland", pdf_path=ALICE_PDF)
    chunker = StructureAwareChunker(target_tokens=300, overlap_tokens=50)
    chunks1 = chunker.chunk_document(doc)
    chunks2 = chunker.chunk_document(doc)

    assert len(chunks1) == len(chunks2)
    for c1, c2 in zip(chunks1, chunks2):
        assert c1.chunk_id == c2.chunk_id
        assert c1.page_start == c2.page_start
        assert c1.token_count == c2.token_count


def test_embedder_dimension_and_consistency():
    q_vec = embedder.embed_query("Who went down the rabbit hole?")
    assert len(q_vec) == config.EMBEDDING_DIMENSION
    assert len(q_vec) == 384

    texts = [
        "Alice was beginning to get very tired of sitting by her sister.",
        "The White Rabbit checked his watch.",
    ]
    doc_vecs = embedder.embed_texts(texts)
    assert len(doc_vecs) == 2
    assert len(doc_vecs[0]) == 384
    assert len(doc_vecs[1]) == 384


# ---------------------------------------------------------------------------
# State Store & Safe Versioning Tests
# ---------------------------------------------------------------------------

def test_state_store_persistence_and_jobs():
    test_id = "test-unit-book"
    from backend.rag.schemas import BookIngestStatus
    st = BookIngestStatus(
        book_id=test_id,
        title="Test Book",
        status="ready",
        active_version=2,
        chunk_count=42,
    )
    state_store.set_book_status(st)
    fetched = state_store.get_book_status(test_id)
    assert fetched is not None
    assert fetched.book_id == test_id
    assert fetched.active_version == 2
    assert fetched.chunk_count == 42

    job = state_store.create_job("test-job-99", 3)
    assert job.status == "pending"
    assert job.total_books == 3
    job.processed_books = 2
    job.status = "running"
    state_store.update_job(job)
    fetched_job = state_store.get_job("test-job-99")
    assert fetched_job.processed_books == 2
    assert fetched_job.status == "running"


# ---------------------------------------------------------------------------
# Retrieval & Isolation Tests
# ---------------------------------------------------------------------------

def test_retrieval_facts_and_active_version():
    """Verify that retrieval extracts relevant chunks from Alice's active version."""
    hits, sufficient, latency_ms = retriever.retrieve(
        book_id=ALICE_BOOK_ID,
        question="What was written on the bottle that Alice found?",
        top_k=5,
    )
    assert len(hits) > 0
    assert sufficient is True
    assert latency_ms > 0
    # Every chunk must belong strictly to this book
    for h in hits:
        assert h["book_id"] == ALICE_BOOK_ID
        assert "text" in h
        assert "score" in h
        assert h["page_start"] >= 1


def test_cross_book_isolation():
    """Verify that queries for Frankenstein characters directed to Alice do not falsely succeed."""
    hits, sufficient, _ = retriever.retrieve(
        book_id=ALICE_BOOK_ID,
        question="What did Victor Frankenstein learn at the university of Ingolstadt?",
        top_k=5,
    )
    # The chunks returned must be from Alice, not Frankenstein
    for h in hits:
        assert h["book_id"] == ALICE_BOOK_ID
    # Sufficient evidence MUST be False for alien question
    assert sufficient is False


def test_negative_query_sufficiency_check():
    """Verify that completely unmentioned topics evaluate to sufficient_evidence=False."""
    hits, sufficient, _ = retriever.retrieve(
        book_id=ALICE_BOOK_ID,
        question="How does Alice build a nuclear submarine?",
        top_k=5,
    )
    assert sufficient is False


# ---------------------------------------------------------------------------
# Generation, Citations & Token Optimization Tests (Mocked LLM)
# ---------------------------------------------------------------------------

def test_generation_grounded_and_token_tracking():
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "Alice found a little bottle with a paper label saying DRINK ME [Source 1]."
    mock_completion.choices = [mock_choice]
    mock_completion.usage.prompt_tokens = 450
    mock_completion.usage.completion_tokens = 28
    mock_completion.usage.total_tokens = 478

    with patch.object(generator, "_get_groq_client") as mock_client:
        mock_inst = MagicMock()
        mock_inst.chat.completions.create.return_value = mock_completion
        mock_client.return_value = mock_inst

        req = ChatRequest(
            book_id=ALICE_BOOK_ID,
            question="What was written on the bottle?",
        )
        resp = rag_pipeline.answer_question(req, "Alice's Adventures in Wonderland")

        assert resp.is_grounded is True
        assert resp.sufficient_evidence is True
        assert len(resp.citations) >= 1
        cit = resp.citations[0]
        assert cit.source_id == 1
        assert cit.book_id == ALICE_BOOK_ID
        assert cit.page_start >= 1
        assert len(cit.excerpt) > 10

        # Verify token metrics in diagnostics
        assert resp.diagnostics is not None
        assert resp.diagnostics.prompt_tokens == 450
        assert resp.diagnostics.completion_tokens == 28
        assert resp.diagnostics.total_tokens == 478
        assert resp.diagnostics.context_tokens > 0


def test_insufficient_evidence_never_fabricates_citations():
    """When evidence is insufficient, generator must return 0 citations."""
    req = ChatRequest(
        book_id=ALICE_BOOK_ID,
        question="How does Alice build a nuclear submarine?",
    )
    resp = rag_pipeline.answer_question(req, "Alice's Adventures in Wonderland")

    assert resp.sufficient_evidence is False
    assert resp.is_grounded is False
    assert "does not contain" in resp.answer or "insufficient" in resp.answer
    assert len(resp.citations) == 0, "Must never return citations when evidence is insufficient!"


def test_query_cache_hit():
    """Subsequent identical queries should hit cache and use 0 LLM tokens."""
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "The Dormouse was sitting between the March Hare and the Hatter [Source 1]."
    mock_completion.choices = [mock_choice]
    mock_completion.usage.prompt_tokens = 500
    mock_completion.usage.completion_tokens = 30
    mock_completion.usage.total_tokens = 530

    with patch.object(generator, "_get_groq_client") as mock_client:
        mock_inst = MagicMock()
        mock_inst.chat.completions.create.return_value = mock_completion
        mock_client.return_value = mock_inst

        req = ChatRequest(
            book_id=ALICE_BOOK_ID,
            question="Who was sitting with the Hatter and March Hare?",
        )
        resp1 = rag_pipeline.answer_question(req, "Alice in Wonderland")
        assert resp1.diagnostics.cached is False

        # Repeat query
        resp2 = rag_pipeline.answer_question(req, "Alice in Wonderland")
        assert resp2.diagnostics.cached is True
        assert resp2.diagnostics.total_tokens == 0
        assert resp2.answer == resp1.answer


# ---------------------------------------------------------------------------
# API Endpoints Tests
# ---------------------------------------------------------------------------

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
    resp = client.post("/api/chat", json={"book_id": "non-existent-book-id", "question": "Hello?"})
    assert resp.status_code in (400, 404)


# ---------------------------------------------------------------------------
# In-Depth Audit Test Suite
# ---------------------------------------------------------------------------

def test_audit_answerable_questions_accepted():
    """Verify that multiple answerable factual and paraphrased queries are correctly accepted."""
    answerable = [
        ("What did Alice find on the three-legged table?", True),
        ("What was the Cheshire Cat doing in the tree?", True),
        ("Who ordered the execution of the gardeners?", True),
        ("Which creature told Alice that one side makes you taller?", True),
    ]
    for q, exp in answerable:
        hits, suff, _ = retriever.retrieve(ALICE_BOOK_ID, q, top_k=5)
        assert len(hits) > 0, f"Expected hits for: {q}"
        assert suff is exp, f"Expected sufficient=True for: {q}"


def test_audit_unanswerable_questions_rejected():
    """Verify that unanswerable queries (even mentioning real characters) are safely rejected."""
    mock_llm_ans = "The text of Alice's Adventures in Wonderland does not mention the Mad Hatter eating Alice's shoes."
    mock_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = mock_llm_ans
    mock_completion.choices = [mock_choice]
    mock_completion.usage.prompt_tokens = 320
    mock_completion.usage.completion_tokens = 25
    mock_completion.usage.total_tokens = 345

    with patch.object(generator, "_get_groq_client") as mock_client:
        mock_inst = MagicMock()
        mock_inst.chat.completions.create.return_value = mock_completion
        mock_client.return_value = mock_inst

        req = ChatRequest(
            book_id=ALICE_BOOK_ID,
            question="Did the Mad Hatter eat Alice's shoes?",
        )
        resp = rag_pipeline.answer_question(req, "Alice in Wonderland")
        assert resp.is_grounded is False
        assert resp.sufficient_evidence is False
        assert len(resp.citations) == 0


def test_audit_strict_book_and_version_isolation():
    """Verify strict active version filtering for Alice and book isolation for legacy Frankenstein."""
    # Alice is version 2
    alice_hits, _, _ = retriever.retrieve(ALICE_BOOK_ID, "Who fell down the rabbit hole?", top_k=5)
    assert len(alice_hits) > 0
    for h in alice_hits:
        assert h["book_id"] == ALICE_BOOK_ID
        assert h["index_version"] == 2

    # Frankenstein is legacy (no version yet)
    frank_id = "frankenstein-mary-shelley"
    frank_hits, _, _ = retriever.retrieve(frank_id, "Who created the monster?", top_k=3)
    assert len(frank_hits) > 0
    for h in frank_hits:
        assert h["book_id"] == frank_id
        assert h["book_id"] != ALICE_BOOK_ID


def test_audit_cache_invalidation_after_reingestion():
    """Verify that clear_book invalidates cached queries for that book."""
    generator.cache.set(
        book_id=ALICE_BOOK_ID,
        question="what is this?",
        chunk_count=5,
        answer="Old cached answer",
        citations=[],
        is_grounded=True,
        model="test-model",
        prompt_tokens=10,
        completion_tokens=5,
        total_tokens=15,
        context_tokens=100,
    )
    assert generator.cache.get(ALICE_BOOK_ID, "what is this?", 5) is not None

    cleared = generator.cache.clear_book(ALICE_BOOK_ID)
    assert cleared >= 1
    assert generator.cache.get(ALICE_BOOK_ID, "what is this?", 5) is None


def test_audit_concurrent_ingestion_lock():
    """Verify that starting ingestion on a book that is already processing raises RuntimeError."""
    from backend.rag.ingestion import ingestion_manager
    from backend.rag.schemas import BookIngestStatus

    # Set temporary processing status
    st = BookIngestStatus(
        book_id="concurrent-test-book",
        title="Concurrent Test",
        status="processing",
        chunk_count=10,
    )
    state_store.set_book_status(st)

    dummy_pdf = ALICE_PDF
    with pytest.raises(RuntimeError, match="already being processed"):
        ingestion_manager.ingest_book_sync("concurrent-test-book", dummy_pdf, "Concurrent Test")

    # Clean up test status
    st.status = "ready"
    state_store.set_book_status(st)


def test_audit_failed_version_activation_preserves_old():
    """Verify that a validation failure aborts activation and keeps old active version."""
    from backend.rag.ingestion import ingestion_manager

    existing = ingestion_manager.get_book_status(ALICE_BOOK_ID)
    initial_version = existing.active_version

    # Simulate validation failure by patching validate_version to return False
    with patch.object(vector_store, "validate_version", return_value=False):
        result = ingestion_manager.ingest_book_sync(
            ALICE_BOOK_ID,
            ALICE_PDF,
            "Alice's Adventures in Wonderland",
        )
        # Should retain previous active status and version
        assert result.active_version == initial_version
        current = ingestion_manager.get_book_status(ALICE_BOOK_ID)
        assert current.active_version == initial_version


def test_audit_recovery_after_restart(tmp_path):
    """Verify that SQLite StateStore automatically recovers interrupted jobs and books on startup."""
    from backend.rag.state_store import StateStore
    db_file = tmp_path / "test_restart.db"
    store1 = StateStore(db_path=db_file)

    # Insert a running job and a processing book
    job = store1.create_job("restart-job-1", 5)
    job.status = "running"
    store1.update_job(job)

    from backend.rag.schemas import BookIngestStatus
    b_st = BookIngestStatus(
        book_id="interrupted-book",
        title="Interrupted Book",
        status="processing",
        chunk_count=50,
    )
    store1.set_book_status(b_st)

    # Simulate server crash and restart: instantiate new StateStore on same DB
    store2 = StateStore(db_path=db_file)
    recovered_job = store2.get_job("restart-job-1")
    assert recovered_job.status == "failed"
    assert "restart" in recovered_job.errors[0].lower()

    recovered_book = store2.get_book_status("interrupted-book")
    assert recovered_book.status == "ready"  # Restored to ready because chunk_count > 0

