"""
Retrieval Pipeline Module
Executes query embedding, isolated book filtering in Qdrant, relevance scoring,
and evidence sufficiency checks.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Tuple

from .config import config
from .embedder import embedder
from .ingestion import ingestion_manager
from .vector_store import vector_store

logger = logging.getLogger("rewamp.rag.retriever")


class BookRetriever:
    """Handles vector similarity retrieval restricted strictly to a single book."""

    def __init__(self) -> None:
        self.min_similarity_score = config.MIN_SIMILARITY_SCORE

    def retrieve(
        self,
        book_id: str,
        question: str,
        top_k: int = config.DEFAULT_TOP_K,
    ) -> Tuple[List[Dict[str, Any]], bool, float]:
        """
        Retrieves top-k chunks matching the question from the specified book.
        Returns:
            - list of chunk dicts
            - sufficient_evidence boolean
            - retrieval_latency_ms float
        """
        start_time = time.perf_counter()

        # Step 1: Validate book readiness
        if not ingestion_manager.is_book_ready(book_id):
            raise ValueError(
                f"Book '{book_id}' has not been indexed yet. Please ingest this book before starting a chat."
            )

        # Step 2: Embed user question with same embedding model
        query_vector = embedder.embed_query(question)

        # Step 3: Search Qdrant with strict book_id filter
        hits = vector_store.search_book(
            book_id=book_id,
            query_vector=query_vector,
            top_k=top_k,
        )

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        if not hits:
            logger.info("Zero vector hits found for book '%s' with question '%s'", book_id, question[:40])
            return [], False, latency_ms

        # Step 4: Evaluate evidence sufficiency
        # Check if the highest scoring passage exceeds min_similarity_score
        highest_score = hits[0]["score"]
        has_sufficient_evidence = highest_score >= self.min_similarity_score

        logger.info(
            "Retrieved %d chunks for book '%s' (top score: %.3f, sufficient: %s, %.1f ms)",
            len(hits),
            book_id,
            highest_score,
            has_sufficient_evidence,
            latency_ms,
        )

        return hits, has_sufficient_evidence, latency_ms


retriever = BookRetriever()
