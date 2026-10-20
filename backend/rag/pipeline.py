"""
RAG Pipeline Orchestrator Module
Coordinates request validation, filtered retrieval, grounded answer generation,
citation structuring, and development diagnostics.
"""

from __future__ import annotations

import logging
import time
from typing import Optional

from .config import config
from .generator import generator
from .retriever import retriever
from .schemas import ChatRequest, ChatResponse, DiagnosticChunk, Diagnostics

logger = logging.getLogger("rewamp.rag.pipeline")


class RagPipeline:
    """End-to-end RAG orchestrator for Rewamp Library."""

    def __init__(self) -> None:
        pass

    def answer_question(
        self,
        request: ChatRequest,
        book_title: str = "",
    ) -> ChatResponse:
        """
        Executes the full RAG pipeline:
        1. Query embedding & filtered Qdrant retrieval for request.book_id
        2. Evidence sufficiency check
        3. Groq LLM answer generation
        4. Structured citation and diagnostic assembly
        """
        total_start = time.perf_counter()
        top_k = request.top_k or config.DEFAULT_TOP_K

        # Step 1: Retrieval
        hits, has_sufficient_evidence, retrieval_latency_ms = retriever.retrieve(
            book_id=request.book_id,
            question=request.question,
            top_k=top_k,
        )

        # Step 2: Generation
        answer, citations, is_grounded, gen_latency_ms, model_used = generator.generate_answer(
            book_title=book_title or request.book_id,
            question=request.question,
            retrieved_chunks=hits,
            has_sufficient_evidence=has_sufficient_evidence,
        )

        total_latency_ms = (time.perf_counter() - total_start) * 1000.0

        # Step 3: Assemble diagnostic inspection data
        diagnostic_chunks = [
            DiagnosticChunk(
                chunk_id=h["chunk_id"],
                page_start=h["page_start"],
                page_end=h["page_end"],
                chapter=h.get("chapter"),
                score=round(h["score"], 4),
                text=h["text"][:250] + ("..." if len(h["text"]) > 250 else ""),
            )
            for h in hits
        ]

        diagnostics = Diagnostics(
            retrieval_time_ms=round(retrieval_latency_ms, 2),
            generation_time_ms=round(gen_latency_ms, 2),
            total_time_ms=round(total_latency_ms, 2),
            model=model_used,
            embedding_model=config.EMBEDDING_MODEL_NAME,
            chunks_retrieved=len(hits),
            sufficient_evidence=has_sufficient_evidence,
            retrieved_chunks=diagnostic_chunks,
        )

        return ChatResponse(
            book_id=request.book_id,
            question=request.question,
            answer=answer,
            citations=citations,
            is_grounded=is_grounded,
            sufficient_evidence=has_sufficient_evidence,
            diagnostics=diagnostics,
        )


rag_pipeline = RagPipeline()
