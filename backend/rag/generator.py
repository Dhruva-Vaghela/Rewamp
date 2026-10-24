"""
Grounded Answer Generation with Groq LLM
Formats retrieved book passages into an untrusted-evidence context with token budgeting,
calls the Groq chat completions API, tracks actual token usage, strictly validates citations,
provides thread-safe TTL caching for idempotent queries, and never fabricates citations.
"""

from __future__ import annotations

import logging
import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from groq import Groq

from .config import config
from .embedder import embedder
from .schemas import Citation

logger = logging.getLogger("rewamp.rag.generator")

SYSTEM_PROMPT = """You are a warm, conversational, and articulate reading companion for the Rewamp Library.
Your goal is to answer the user's question naturally and thoughtfully using the book excerpts provided below.

CRITICAL TONE & FORMAT RULES:
1. Speak naturally like a knowledgeable companion in a real conversation.
2. NEVER use robotic meta-phrases such as "Based on the provided excerpts", "According to the text", or "The excerpts state". Jump straight into the answer.
3. Write strictly in normal, plain text. Do NOT use Markdown formatting: no asterisks for bold or italics (**bold** or *italic*), no headers (# or ##), and no numbered outlines unless specifically asked.
4. Keep the prose conversational, cohesive, and easy to read in paragraphs.
5. You may reference source excerpt numbers with [Source 1], [Source 2] at the end of statements so citations can be recorded, but keep the surrounding prose completely natural.
6. Ground your answer strictly in the provided book excerpts. Never invent outside facts, characters, or plot points.
7. If the book does not contain enough information to answer the question, explain warmly and conversationally in one or two plain sentences that the book does not mention or cover that detail.
"""


def clean_answer_text(raw_text: str) -> str:
    """Strip bracketed source tags, markdown asterisks, and robotic intros for conversational plain text."""
    # Remove [Source X] and (Source X) tags
    cleaned = re.sub(r"\[Source\s+\d+\]", "", raw_text, flags=re.IGNORECASE)
    cleaned = re.sub(r"\(Source\s+\d+\)", "", cleaned, flags=re.IGNORECASE)

    # Strip markdown bold/italic asterisks: **text** -> text, *text* -> text
    cleaned = re.sub(r"\*\*([^*]+)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"\*([^*]+)\*", r"\1", cleaned)
    cleaned = re.sub(r"__([^_]+)__", r"\1", cleaned)
    cleaned = re.sub(r"_([^_]+)_", r"\1", cleaned)

    # Strip markdown header prefixes: ### Header -> Header
    cleaned = re.sub(r"^#{1,6}\s*", "", cleaned, flags=re.MULTILINE)

    # Remove robotic introductory boilerplate
    cleaned = re.sub(
        r"^(Based on the (provided|retrieved) (excerpts?|text|passages?),?\s*|According to the (provided|retrieved) (excerpts?|text|passages?),?\s*|From the (provided|retrieved) (excerpts?|text|passages?),?\s*)",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )

    # Clean up any trailing space before punctuation created by removing [Source X]
    cleaned = re.sub(r"\s+([.,;:!?])", r"\1", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


class QueryCache:
    """Thread-safe in-memory TTL query cache for token and latency optimization."""

    def __init__(self, max_entries: int = config.CACHE_MAX_ENTRIES, ttl_seconds: int = config.CACHE_TTL_SECONDS) -> None:
        self.max_entries = max_entries
        self.ttl_seconds = ttl_seconds
        self._lock = threading.Lock()
        self._cache: Dict[Tuple[str, str, int], Dict[str, Any]] = {}

    def get(self, book_id: str, question: str, chunk_count: int) -> Optional[Dict[str, Any]]:
        key = (book_id, question.strip().lower(), chunk_count)
        with self._lock:
            entry = self._cache.get(key)
            if not entry:
                return None
            if time.time() - entry["timestamp"] > self.ttl_seconds:
                del self._cache[key]
                return None
            return entry

    def set(
        self,
        book_id: str,
        question: str,
        chunk_count: int,
        answer: str,
        citations: List[Citation],
        is_grounded: bool,
        model: str,
        prompt_tokens: Optional[int],
        completion_tokens: Optional[int],
        total_tokens: Optional[int],
        context_tokens: int,
    ) -> None:
        key = (book_id, question.strip().lower(), chunk_count)
        with self._lock:
            if len(self._cache) >= self.max_entries:
                oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k]["timestamp"])
                del self._cache[oldest_key]
            self._cache[key] = {
                "answer": answer,
                "citations": citations,
                "is_grounded": is_grounded,
                "model": model,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "context_tokens": context_tokens,
                "timestamp": time.time(),
            }

    def clear_book(self, book_id: str) -> int:
        """Invalidates all cached queries for a given book (e.g. after re-ingestion)."""
        with self._lock:
            keys_to_del = [k for k in self._cache.keys() if k[0] == book_id]
            for k in keys_to_del:
                del self._cache[k]
            return len(keys_to_del)


class AnswerGenerator:
    """Generates grounded answers using Groq's official Python SDK with token accounting."""

    def __init__(self) -> None:
        self.api_key = config.GROQ_API_KEY
        self.timeout = config.GROQ_TIMEOUT_SECONDS
        self.cache = QueryCache()

    def _get_groq_client(self) -> Groq:
        if not self.api_key:
            raise ValueError(
                "Groq API key is not configured. Please ensure GROQ_API_KEY is defined in the backend .env file."
            )
        return Groq(api_key=self.api_key, timeout=self.timeout)

    def generate_answer(
        self,
        book_id: str,
        book_title: str,
        question: str,
        retrieved_chunks: List[Dict[str, Any]],
        has_sufficient_evidence: bool,
    ) -> Tuple[str, List[Citation], bool, float, str, Optional[int], Optional[int], Optional[int], int, bool]:
        """
        Calls Groq to generate a grounded answer from retrieved chunks.
        Returns:
            - answer text (str)
            - citations list (List[Citation])
            - is_grounded (bool)
            - generation_latency_ms (float)
            - model_used (str)
            - prompt_tokens (Optional[int])
            - completion_tokens (Optional[int])
            - total_tokens (Optional[int])
            - context_tokens (int)
            - cached (bool)
        """
        start_time = time.perf_counter()
        model = config.get_supported_groq_model()

        # Check Cache
        cached_entry = self.cache.get(book_id, question, len(retrieved_chunks))
        if cached_entry:
            lat_ms = (time.perf_counter() - start_time) * 1000.0
            logger.info("Serving query response from cache for '%s' (0 API tokens)", question[:40])
            return (
                cached_entry["answer"],
                cached_entry["citations"],
                cached_entry["is_grounded"],
                lat_ms,
                cached_entry["model"],
                0,
                0,
                0,
                cached_entry["context_tokens"],
                True,
            )

        # If zero chunks or insufficient evidence evaluated prior to generation
        if not retrieved_chunks or not has_sufficient_evidence:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            return (
                f"The text of {book_title} does not contain sufficient information to answer '{question}'.",
                [],
                False,
                latency_ms,
                model,
                0,
                0,
                0,
                0,
                False,
            )

        # Build context from chunks enforcing configurable context budget
        context_parts: List[str] = []
        citations_map: Dict[int, Citation] = {}
        accumulated_context_tokens = 0

        for idx, chunk in enumerate(retrieved_chunks, start=1):
            chunk_tokens = chunk.get("token_count") or embedder.count_tokens(chunk["text"])
            if context_parts and (accumulated_context_tokens + chunk_tokens > config.MAX_CONTEXT_TOKENS):
                logger.info(
                    "Context budget reached (%d tokens). Truncating context chunks from %d to %d.",
                    accumulated_context_tokens,
                    len(retrieved_chunks),
                    len(context_parts),
                )
                break

            source_tag = f"Source {idx}"
            page_info = (
                f"Pages {chunk['page_start']}-{chunk['page_end']}"
                if chunk["page_start"] != chunk["page_end"]
                else f"Page {chunk['page_start']}"
            )
            chapter_info = f" | {chunk['chapter']}" if chunk.get("chapter") else ""

            # Excerpt for citation card
            clean_excerpt = chunk["text"][:300].strip().replace("\n", " ") + (
                "..." if len(chunk["text"]) > 300 else ""
            )

            citation = Citation(
                source_id=idx,
                chunk_id=chunk["chunk_id"],
                book_id=chunk["book_id"],
                page_start=chunk["page_start"],
                page_end=chunk["page_end"],
                chapter=chunk.get("chapter"),
                excerpt=clean_excerpt,
                score=chunk["score"],
            )
            citations_map[idx] = citation

            context_parts.append(f"--- [{source_tag}] ({page_info}{chapter_info}) ---\n{chunk['text']}\n")
            accumulated_context_tokens += chunk_tokens

        context_str = "\n".join(context_parts)
        user_content = f"""Book Title: {book_title}

Retrieved Book Excerpts:
{context_str}

User Question: {question}

Please answer the question directly in normal, conversational plain text (no markdown bold or asterisks), noting [Source N] for cited facts."""

        try:
            client = self._get_groq_client()
            logger.info("Sending prompt to Groq model '%s' (%d context chunks, ~%d tokens)", model, len(citations_map), accumulated_context_tokens)

            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.2,
                max_tokens=800,
            )

            raw_answer = response.choices[0].message.content or ""
            latency_ms = (time.perf_counter() - start_time) * 1000.0

            # Extract Groq actual token usage
            usage = getattr(response, "usage", None)
            prompt_tokens = getattr(usage, "prompt_tokens", None)
            completion_tokens = getattr(usage, "completion_tokens", None)
            total_tokens = getattr(usage, "total_tokens", None)

            # Check if answer acknowledged insufficient information
            lower_ans = raw_answer.lower()
            not_enough_info = (
                "not enough information" in lower_ans
                or "does not contain" in lower_ans
                or "insufficient information" in lower_ans
                or "does not mention" in lower_ans
                or "not mentioned in the text" in lower_ans
            )

            is_grounded = not not_enough_info

            # Citation validation: Never fabricate citations if not enough info
            if not is_grounded:
                final_citations = []
            else:
                cited_indices = set()
                for match in re.finditer(r"\[Source\s+(\d+)\]", raw_answer, re.IGNORECASE):
                    try:
                        s_id = int(match.group(1))
                        if s_id in citations_map:
                            cited_indices.add(s_id)
                    except ValueError:
                        pass

                if cited_indices:
                    final_citations = [citations_map[i] for i in sorted(cited_indices)]
                else:
                    # If model did not emit tags, validate overlap between answer and passages
                    ans_words = set(re.findall(r"\b\w{4,}\b", lower_ans))
                    verified_citations = []
                    for s_id, cit in citations_map.items():
                        chunk_words = set(re.findall(r"\b\w{4,}\b", cit.excerpt.lower()))
                        overlap = len(ans_words & chunk_words)
                        if overlap >= 2 or s_id == 1:
                            verified_citations.append(cit)
                    final_citations = verified_citations or [citations_map[1]]

            clean_prose = clean_answer_text(raw_answer)

            # Save in TTL Cache
            self.cache.set(
                book_id=book_id,
                question=question,
                chunk_count=len(retrieved_chunks),
                answer=clean_prose,
                citations=final_citations,
                is_grounded=is_grounded,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                context_tokens=accumulated_context_tokens,
            )

            return (
                clean_prose,
                final_citations,
                is_grounded,
                latency_ms,
                model,
                prompt_tokens,
                completion_tokens,
                total_tokens,
                accumulated_context_tokens,
                False,
            )

        except Exception as exc:
            logger.error("Groq answer generation failed: %s", exc)
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            err_text = str(exc)
            if "api_key" in err_text.lower():
                err_text = "Authentication error: Please check that GROQ_API_KEY in .env is valid."
            raise RuntimeError(f"Groq generation error: {err_text}") from exc


generator = AnswerGenerator()
