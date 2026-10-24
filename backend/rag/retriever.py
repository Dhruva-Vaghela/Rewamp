"""
Retrieval Pipeline Module
Executes query embedding, isolated book filtering in Qdrant with active index versions,
candidate deduplication, hybrid lexical rescoring, and evaluated evidence-sufficiency checks.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Any, Dict, List, Optional, Set, Tuple

from .config import config
from .embedder import embedder
from .ingestion import ingestion_manager
from .vector_store import vector_store

logger = logging.getLogger("rewamp.rag.retriever")

STOPWORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't",
    "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't",
    "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
    "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll",
    "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's",
    "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on",
    "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own",
    "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some",
    "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then",
    "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this",
    "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we",
    "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's",
    "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", "with",
    "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
}


def extract_content_words(text: str, exclude_terms: Optional[Set[str]] = None) -> List[str]:
    """Extract content words from text, excluding stopwords and optional book terms."""
    words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())
    excluded = STOPWORDS if exclude_terms is None else STOPWORDS | exclude_terms
    return [w for w in words if w not in excluded]


def compute_jaccard_similarity(words_a: Set[str], words_b: Set[str]) -> float:
    """Calculates Jaccard overlap similarity between two sets of words."""
    if not words_a or not words_b:
        return 0.0
    intersection = len(words_a & words_b)
    union = len(words_a | words_b)
    return intersection / union if union > 0 else 0.0


def compute_lexical_score(content_words: List[str], chunk_text: str) -> float:
    """Calculates keyword match coverage and phrase bonus for a chunk."""
    if not content_words:
        return 0.5
    text_lower = chunk_text.lower()
    matches = sum(1 for w in content_words if w in text_lower)
    coverage = matches / len(content_words)

    # Bonus if 2 or more adjacent query words appear consecutively
    phrase_bonus = 0.0
    if len(content_words) >= 2:
        for i in range(len(content_words) - 1):
            pair = f"{content_words[i]} {content_words[i+1]}"
            if pair in text_lower:
                phrase_bonus = 0.25
                break

    return min(1.0, coverage + phrase_bonus)


class BookRetriever:
    """Handles vector similarity retrieval restricted strictly to a single book and active version."""

    def __init__(self) -> None:
        self.candidate_pool = config.RETRIEVAL_CANDIDATE_POOL
        self.dedup_threshold = config.DEDUPLICATION_THRESHOLD
        self.min_similarity_score = config.MIN_SIMILARITY_SCORE

    def retrieve(
        self,
        book_id: str,
        question: str,
        top_k: int = config.DEFAULT_TOP_K,
    ) -> Tuple[List[Dict[str, Any]], bool, float]:
        """
        Retrieves top-k chunks matching the question from the specified book.
        Enforces:
          - Active index version isolation
          - Near-duplicate candidate suppression
          - Hybrid lexical-dense rescoring
          - Evaluated multi-factor evidence sufficiency check
        Returns:
            - list of chunk dicts
            - sufficient_evidence boolean
            - retrieval_latency_ms float
        """
        start_time = time.perf_counter()

        # Step 1: Validate book readiness and retrieve active version
        st = ingestion_manager.get_book_status(book_id)
        if not st or st.status != "ready" or st.chunk_count == 0:
            raise ValueError(
                f"Book '{book_id}' has not been indexed yet. Please ingest this book before starting a chat."
            )
        active_version = st.active_version

        # Step 2: Embed query
        query_vector = embedder.embed_query(question)

        # Step 3: Search Qdrant with candidate pool size (e.g. 15 candidates) and active_version filter
        raw_hits = vector_store.search_book(
            book_id=book_id,
            query_vector=query_vector,
            top_k=max(top_k * 2, self.candidate_pool),
            active_version=active_version,
        )

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        if not raw_hits:
            logger.info("Zero vector hits found for book '%s' with question '%s'", book_id, question[:40])
            return [], False, latency_ms

        # Step 4: Extract query content words (excluding book ID words)
        book_id_words = set(book_id.lower().replace("-", " ").split())
        query_content_words = extract_content_words(question, exclude_terms=book_id_words)

        # Step 5: Candidate Deduplication & Hybrid Rescoring
        deduped_candidates: List[Dict[str, Any]] = []
        selected_word_sets: List[Set[str]] = []

        for hit in raw_hits:
            hit_text = hit["text"]
            hit_words = set(re.findall(r"\b\w+\b", hit_text.lower()))

            # Check overlap against already chosen candidates
            is_duplicate = False
            for prev_words in selected_word_sets:
                sim = compute_jaccard_similarity(hit_words, prev_words)
                if sim >= self.dedup_threshold:
                    is_duplicate = True
                    break

            if not is_duplicate:
                selected_word_sets.append(hit_words)
                lexical_score = compute_lexical_score(query_content_words, hit_text)
                dense_score = hit["score"]
                # 75% dense semantic score, 25% lexical keyword match
                hybrid_score = 0.75 * dense_score + 0.25 * lexical_score

                hit["dense_score"] = dense_score
                hit["lexical_score"] = round(lexical_score, 4)
                hit["hybrid_score"] = round(hybrid_score, 4)
                hit["score"] = hybrid_score  # Used for sorting and citation relevance
                deduped_candidates.append(hit)

        # Sort by hybrid score and take top_k
        deduped_candidates.sort(key=lambda x: x["hybrid_score"], reverse=True)
        final_hits = deduped_candidates[:top_k]

        # Step 6: Evaluated Evidence Sufficiency
        has_sufficient_evidence = self._evaluate_evidence_sufficiency(
            question=question,
            content_words=query_content_words,
            final_hits=final_hits,
        )

        top_score = final_hits[0]["score"] if final_hits else 0.0
        logger.info(
            "Retrieved %d deduplicated chunks for book '%s' (top hybrid: %.3f, dense: %.3f, sufficient: %s, %.1f ms)",
            len(final_hits),
            book_id,
            top_score,
            final_hits[0].get("dense_score", top_score) if final_hits else 0.0,
            has_sufficient_evidence,
            latency_ms,
        )

        return final_hits, has_sufficient_evidence, latency_ms

    def _evaluate_evidence_sufficiency(
        self,
        question: str,
        content_words: List[str],
        final_hits: List[Dict[str, Any]],
    ) -> bool:
        """
        Evaluates whether retrieved passages contain genuine evidence to answer the question.
        Replaces rigid similarity thresholds with multi-factor evidence check:
          - Minimum dense score
          - Informative keyword presence / coverage across top passages
          - Gap between candidate scores
        """
        if not final_hits:
            return False

        top_hit = final_hits[0]
        top_dense = top_hit.get("dense_score", top_hit["score"])

        # Below absolute noise floor
        if top_dense < 0.52:
            return False

        # Strong semantic match (>= 0.72) is highly confident
        if top_dense >= 0.72:
            return True

        if not content_words:
            return top_dense >= self.min_similarity_score

        # Check coverage of content words across top 3 retrieved chunks
        top_passages_text = " ".join(h["text"].lower() for h in final_hits[:3])
        matched_words = [w for w in content_words if w in top_passages_text]
        coverage = len(matched_words) / len(content_words)

        # If dense score is borderline (0.52 - 0.68) and content keyword coverage is < 40%,
        # the model retrieved generic prose rather than answer evidence
        if top_dense < 0.68 and coverage < 0.40:
            return False

        return top_dense >= self.min_similarity_score or coverage >= 0.50


retriever = BookRetriever()
