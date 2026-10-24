"""
Pydantic Schemas for RAG and Chat API
Clean, strongly typed request and response contracts.
"""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Ingestion Models
# ---------------------------------------------------------------------------

class BookIngestStatus(BaseModel):
    book_id: str
    title: str
    status: str = Field(..., description="One of: pending, processing, ready, failed")
    chunk_count: int = 0
    active_version: Optional[int] = None
    file_hash: Optional[str] = None
    config_hash: Optional[str] = None
    error: Optional[str] = None
    updated_at: Optional[str] = None


class IngestJobResponse(BaseModel):
    job_id: str
    status: str
    message: str
    book_id: Optional[str] = None


class IngestJobProgress(BaseModel):
    job_id: str
    status: str  # pending, running, completed, completed_with_errors, failed
    total_books: int
    processed_books: int
    current_book: Optional[str] = None
    errors: List[str] = []
    completed_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Chat & RAG Query Models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    book_id: str = Field(..., description="ID of the book to query against (isolation enforced)")
    question: str = Field(..., min_length=2, max_length=1000, description="User question")
    top_k: Optional[int] = Field(default=5, ge=1, le=20, description="Number of passages to retrieve")


class Citation(BaseModel):
    source_id: int
    chunk_id: str
    book_id: str
    page_start: int
    page_end: int
    chapter: Optional[str] = None
    excerpt: str
    score: float


class DiagnosticChunk(BaseModel):
    chunk_id: str
    page_start: int
    page_end: int
    chapter: Optional[str] = None
    score: float
    text: str


class Diagnostics(BaseModel):
    retrieval_time_ms: float
    generation_time_ms: float
    total_time_ms: float
    model: str
    embedding_model: str
    chunks_retrieved: int
    sufficient_evidence: bool
    retrieved_chunks: List[DiagnosticChunk] = []
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    context_tokens: Optional[int] = None
    cached: Optional[bool] = False
    # Diagnostic inspection fields
    selected_book: Optional[str] = None
    active_index_version: Optional[int] = None
    retrieval_strategy: Optional[str] = None
    candidate_counts: Optional[int] = None
    refusal_reason: Optional[str] = None


class ChatResponse(BaseModel):
    book_id: str
    question: str
    answer: str
    citations: List[Citation]
    is_grounded: bool
    sufficient_evidence: bool
    diagnostics: Optional[Diagnostics] = None


# ---------------------------------------------------------------------------
# Health & Diagnostic Models
# ---------------------------------------------------------------------------

class DependencyStatus(BaseModel):
    qdrant: bool
    groq: bool
    collection_ready: bool
    active_model: str
    embedding_model: str


class SystemHealthResponse(BaseModel):
    status: str
    books_count: int
    ready_books_count: int
    dependencies: DependencyStatus
