"""
Qdrant Cloud Vector Store Integration
Manages collection lifecycle, idempotent chunk storage, and book-filtered retrieval.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from qdrant_client.http.exceptions import UnexpectedResponse

from .chunker import TextChunk
from .config import config

logger = logging.getLogger("rewamp.rag.vector_store")


class VectorStoreService:
    """Manages Qdrant Cloud operations."""

    def __init__(self) -> None:
        self.url = config.QDRANT_URL
        self.api_key = config.QDRANT_API_KEY
        self.collection_name = config.QDRANT_COLLECTION_NAME
        self.dimension = config.EMBEDDING_DIMENSION
        self._client: Optional[QdrantClient] = None

    def get_client(self) -> QdrantClient:
        """Returns active QdrantClient instance with connection checks."""
        if self._client is None:
            if not self.url or not self.api_key:
                raise ValueError("Qdrant Cloud credentials missing. Please set QDRANT_URL and QDRANT_API_KEY in .env.")
            try:
                self._client = QdrantClient(
                    url=self.url,
                    api_key=self.api_key,
                    timeout=20.0,
                )
            except Exception as exc:
                logger.error("Failed to connect to Qdrant Cloud: %s", exc)
                raise ConnectionError(f"Could not connect to Qdrant Cloud: {exc}") from exc
        return self._client

    def ensure_collection(self) -> None:
        """
        Inspects the collection. Creates it if missing.
        Never deletes or overwrites an existing populated collection.
        Ensures a payload index on 'book_id' for isolated filtering.
        """
        client = self.get_client()
        try:
            exists = client.collection_exists(self.collection_name)
            if not exists:
                logger.info(
                    "Collection '%s' does not exist. Creating with dim=%d, distance=Cosine...",
                    self.collection_name,
                    self.dimension,
                )
                client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=qmodels.VectorParams(
                        size=self.dimension,
                        distance=qmodels.Distance.COSINE,
                    ),
                )
                # Create keyword index on book_id for fast filtered retrieval
                try:
                    client.create_payload_index(
                        collection_name=self.collection_name,
                        field_name="book_id",
                        field_schema=qmodels.PayloadSchemaType.KEYWORD,
                    )
                    logger.info("Created keyword payload index on 'book_id'")
                except Exception as idx_exc:
                    logger.warning("Could not create payload index on book_id (may already exist): %s", idx_exc)
            else:
                logger.info("Collection '%s' verified on Qdrant Cloud.", self.collection_name)
        except Exception as exc:
            logger.error("Error verifying/creating collection '%s': %s", self.collection_name, exc)
            raise

    def count_chunks_for_book(self, book_id: str) -> int:
        """Returns the number of vectors stored for a specific book."""
        client = self.get_client()
        try:
            self.ensure_collection()
            count_result = client.count(
                collection_name=self.collection_name,
                count_filter=qmodels.Filter(
                    must=[
                        qmodels.FieldCondition(
                            key="book_id",
                            match=qmodels.MatchValue(value=book_id),
                        )
                    ]
                ),
            )
            return count_result.count
        except Exception as exc:
            logger.warning("Failed to count chunks for book '%s': %s", book_id, exc)
            return 0

    def delete_book_chunks(self, book_id: str) -> None:
        """Removes existing chunks for a book before re-ingesting."""
        client = self.get_client()
        try:
            if client.collection_exists(self.collection_name):
                client.delete(
                    collection_name=self.collection_name,
                    points_selector=qmodels.FilterSelector(
                        filter=qmodels.Filter(
                            must=[
                                qmodels.FieldCondition(
                                    key="book_id",
                                    match=qmodels.MatchValue(value=book_id),
                                )
                            ]
                        )
                    ),
                )
                logger.info("Deleted previous chunks for book '%s'", book_id)
        except Exception as exc:
            logger.warning("Error deleting chunks for book '%s': %s", book_id, exc)

    def upsert_chunks(self, chunks: List[TextChunk], vectors: List[List[float]]) -> int:
        """
        Stores chunks and vectors into Qdrant Cloud with deterministic UUIDs.
        Ensures idempotency: running again with the same chunks updates existing points.
        """
        if not chunks or not vectors or len(chunks) != len(vectors):
            raise ValueError("Mismatched chunk and vector counts")

        client = self.get_client()
        self.ensure_collection()

        points: List[qmodels.PointStruct] = []
        for chunk, vector in zip(chunks, vectors):
            # Deterministic UUID5 based on chunk_id prevents duplicates
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, chunk.chunk_id))
            payload = {
                "book_id": chunk.book_id,
                "chunk_id": chunk.chunk_id,
                "text": chunk.text,
                "page_start": chunk.page_start,
                "page_end": chunk.page_end,
                "chapter": chunk.chapter,
                "char_count": chunk.char_count,
                "token_count_est": chunk.token_count_est,
            }
            points.append(
                qmodels.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload,
                )
            )

        # Batch upload to avoid timeouts on large documents (e.g. batches of 100)
        batch_size = 100
        for i in range(0, len(points), batch_size):
            batch = points[i : i + batch_size]
            client.upsert(
                collection_name=self.collection_name,
                points=batch,
                wait=True,
            )

        logger.info("Successfully upserted %d points to collection '%s'", len(points), self.collection_name)
        return len(points)

    def search_book(
        self,
        book_id: str,
        query_vector: List[float],
        top_k: int = config.DEFAULT_TOP_K,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve the top-k most relevant chunks for a specific book.
        Enforces strict book isolation with a mandatory Filter on `book_id`.
        """
        client = self.get_client()
        self.ensure_collection()

        book_filter = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="book_id",
                    match=qmodels.MatchValue(value=book_id),
                )
            ]
        )

        try:
            # In qdrant-client >= 1.10, search or query_points can be used
            # We support both query_points and search
            if hasattr(client, "query_points"):
                results = client.query_points(
                    collection_name=self.collection_name,
                    query=query_vector,
                    query_filter=book_filter,
                    limit=top_k,
                    with_payload=True,
                ).points
            else:
                results = client.search(
                    collection_name=self.collection_name,
                    query_vector=query_vector,
                    query_filter=book_filter,
                    limit=top_k,
                    with_payload=True,
                )

            hits: List[Dict[str, Any]] = []
            for hit in results:
                payload = hit.payload or {}
                hits.append(
                    {
                        "chunk_id": payload.get("chunk_id", ""),
                        "book_id": payload.get("book_id", ""),
                        "text": payload.get("text", ""),
                        "page_start": payload.get("page_start", 1),
                        "page_end": payload.get("page_end", 1),
                        "chapter": payload.get("chapter"),
                        "score": float(hit.score),
                    }
                )
            return hits
        except Exception as exc:
            logger.error("Search failed for book '%s': %s", book_id, exc)
            raise RuntimeError(f"Vector search failed: {exc}") from exc


vector_store = VectorStoreService()
