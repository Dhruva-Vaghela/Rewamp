"""
Rewamp RAG Configuration Module
Centralized, safe configuration for Qdrant Cloud, Groq LLM, embeddings, and retrieval.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

logger = logging.getLogger("rewamp.rag.config")

# Locate .env in project root or backend dir
_BASE_DIR = Path(__file__).resolve().parent.parent
_ROOT_DIR = _BASE_DIR.parent

_env_candidates = [
    _ROOT_DIR / ".env",
    _BASE_DIR / ".env",
]

for _env_path in _env_candidates:
    if _env_path.exists():
        load_dotenv(dotenv_path=_env_path)
        logger.info("Loaded environment variables from %s", _env_path)
        break


class RagConfig:
    # --- Paths ---
    BASE_DIR: Path = _BASE_DIR
    BOOKS_DIR: Path = _BASE_DIR / "data" / "books"
    COVERS_DIR: Path = _BASE_DIR / "data" / "covers"
    DATA_DIR: Path = _BASE_DIR / "data"
    STATUS_FILE: Path = _BASE_DIR / "data" / "ingestion_status.json"

    # --- Qdrant Cloud ---
    QDRANT_URL: str = os.getenv("QDRANT_URL", "").strip()
    QDRANT_API_KEY: str = os.getenv("QDRANT_API_KEY", "").strip()
    QDRANT_COLLECTION_NAME: str = os.getenv("QDRANT_COLLECTION_NAME", "book_chunks").strip()

    # --- Embeddings ---
    EMBEDDING_MODEL_NAME: str = os.getenv("EMBEDDING_MODEL_NAME", "BAAI/bge-small-en-v1.5")
    EMBEDDING_DIMENSION: int = 384
    EMBEDDING_DISTANCE: str = "Cosine"

    # --- Chunking ---
    # Approximate 1 token ~= 4 characters for English prose
    CHUNK_SIZE_TOKENS: int = 500
    CHUNK_OVERLAP_TOKENS: int = 80
    TARGET_CHUNK_CHARS: int = CHUNK_SIZE_TOKENS * 4      # ~2000 chars
    CHUNK_OVERLAP_CHARS: int = CHUNK_OVERLAP_TOKENS * 4   # ~320 chars

    # --- Retrieval ---
    DEFAULT_TOP_K: int = 5
    # Cosine similarity threshold for evidence sufficiency
    MIN_SIMILARITY_SCORE: float = 0.35

    # --- Groq LLM ---
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
    DEFAULT_GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b").strip()
    GROQ_TIMEOUT_SECONDS: float = 30.0

    @classmethod
    def validate_keys(cls) -> dict[str, bool]:
        """Returns availability of critical credentials without leaking secrets."""
        return {
            "has_qdrant_url": bool(cls.QDRANT_URL),
            "has_qdrant_api_key": bool(cls.QDRANT_API_KEY),
            "has_groq_api_key": bool(cls.GROQ_API_KEY),
        }

    @classmethod
    def get_supported_groq_model(cls) -> str:
        """
        Dynamically discover and pick an available Groq chat model.
        Falls back to DEFAULT_GROQ_MODEL if discovery fails or candidate is valid.
        """
        if not cls.GROQ_API_KEY:
            return cls.DEFAULT_GROQ_MODEL

        # Priority list of high-quality conversational Groq models
        priority_candidates = [
            cls.DEFAULT_GROQ_MODEL,
            "qwen/qwen3.8-27b",
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "allam-2-7b",
        ]

        try:
            from groq import Groq

            client = Groq(api_key=cls.GROQ_API_KEY, timeout=5.0)
            models_resp = client.models.list()
            active_ids = {m.id for m in models_resp.data if getattr(m, "active", True)}

            for candidate in priority_candidates:
                if candidate in active_ids:
                    return candidate

            # If none of our preferred models are in the active set, find any text chat model
            for m in models_resp.data:
                mid = m.id.lower()
                if "guard" not in mid and "whisper" not in mid and "orpheus" not in mid:
                    return m.id
        except Exception as exc:
            logger.warning("Groq model discovery failed (%s). Falling back to default: %s", exc, cls.DEFAULT_GROQ_MODEL)

        return cls.DEFAULT_GROQ_MODEL


config = RagConfig()
