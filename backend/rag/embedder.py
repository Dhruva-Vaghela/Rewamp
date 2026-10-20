"""
Embedding Generation Module
Generates dense vector embeddings using local FastEmbed (BAAI/bge-small-en-v1.5).
Consistently embeds both document chunks and user search queries.
Dimension: 384
"""

from __future__ import annotations

import logging
from typing import List, Optional

from .config import config

logger = logging.getLogger("rewamp.rag.embedder")


class EmbeddingService:
    """Manages dense semantic embedding generation."""

    _instance: Optional[EmbeddingService] = None
    _model = None

    @classmethod
    def get_instance(cls) -> EmbeddingService:
        if cls._instance is None:
            cls._instance = EmbeddingService()
        return cls._instance

    def __init__(self) -> None:
        self.model_name = config.EMBEDDING_MODEL_NAME
        self.dimension = config.EMBEDDING_DIMENSION
        self._ensure_model()

    def _ensure_model(self) -> None:
        if self._model is None:
            try:
                from fastembed import TextEmbedding

                logger.info("Initializing embedding model: %s", self.model_name)
                self._model = TextEmbedding(model_name=self.model_name)
            except Exception as exc:
                logger.error("Failed to initialize embedding model %s: %s", self.model_name, exc)
                raise RuntimeError(f"Embedding model initialization failed: {exc}") from exc

    def embed_texts(self, texts: List[str], batch_size: int = 64) -> List[List[float]]:
        """
        Embed a list of text strings in batches.
        Returns a list of 384-dimensional float vectors.
        """
        if not texts:
            return []

        self._ensure_model()
        try:
            # fastembed.embed returns a generator of numpy arrays
            raw_generator = self._model.embed(texts, batch_size=batch_size)
            vectors: List[List[float]] = [vec.tolist() for vec in raw_generator]

            # Validate dimensions
            if vectors and len(vectors[0]) != self.dimension:
                raise ValueError(
                    f"Generated embedding dimension {len(vectors[0])} does not match expected {self.dimension}"
                )

            return vectors
        except Exception as exc:
            logger.error("Embedding generation error: %s", exc)
            raise RuntimeError(f"Failed to generate embeddings: {exc}") from exc

    def embed_query(self, query: str) -> List[float]:
        """
        Embed a single search query with identical preprocessing.
        """
        clean_query = query.strip()
        if not clean_query:
            raise ValueError("Query string cannot be empty")

        vectors = self.embed_texts([clean_query])
        if not vectors:
            raise RuntimeError("Failed to compute embedding for query")
        return vectors[0]


embedder = EmbeddingService.get_instance()
