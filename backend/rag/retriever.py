"""
Retrieval Pipeline Module
Executes intent-aware query expansion, isolated book filtering in Qdrant with active index versions,
multi-angle candidate retrieval, cross-narrative deduplication, adaptive hybrid rescoring,
and collective evidence-sufficiency evaluation for broad synthesis and factual questions.
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

# Meta-discourse scaffolding words commonly found in questions rather than literary text
META_DISCOURSE_WORDS: Set[str] = {
    "major", "turning", "point", "points", "crisis", "crises", "climax", "climaxes", "climactic",
    "narrative", "story", "book", "novel", "text", "chapter", "chapters", "theme", "themes",
    "motif", "motifs", "occur", "occurs", "occurring", "occurred", "happen", "happens", "happening",
    "happened", "describe", "describes", "described", "summarize", "summary", "overview", "explored",
    "central", "primary", "main", "initial", "throughout", "depict", "depicts", "depicted",
    "discuss", "discusses", "significant", "significance", "consequence", "consequences",
    "element", "elements", "take", "place", "takes", "detail", "details", "overall", "aspect", "aspects",
}

BROAD_INTENT_PATTERNS = [
    (
        re.compile(r"\b(turning\s+point|crisis|crises|climax|climactic|downfall|catastrophe)\b", re.I),
        "turning_point",
        [
            "pivotal crisis climax downfall catastrophe disaster turning point",
            "critical turning point conflict resolution tragedy ruin decisive revelation",
        ],
    ),
    (
        re.compile(r"\b(theme|themes|motif|motifs|symbolism|symbolize|symbol|moral|meaning)\b", re.I),
        "theme_motif",
        [
            "central themes recurring motifs moral lesson truth society human nature",
            "philosophical meaning values struggle social condition core ideas",
        ],
    ),
    (
        re.compile(r"\b(conflict|conflicts|central\s+conflict|initial\s+conflict|struggle|dispute|feud|confrontation)\b", re.I),
        "conflict",
        [
            "central conflict dispute confrontation opposition struggle",
            "cause origin consequence rivalry tension resolution",
        ],
    ),
    (
        re.compile(r"\b(character\s+development|transform|transformation|evolve|relationship\s+between|dynamic\s+between)\b", re.I),
        "character_arc",
        [
            "character growth change realization relationship conflict dynamic",
            "evolution decision loyalty betrayal bond transformation",
        ],
    ),
    (
        re.compile(r"\b(summarize|summary|narrative\s+arc|story\s+arc|major\s+events|overall\s+story)\b", re.I),
        "summary_arc",
        [
            "beginning development turning point climax conclusion overview",
            "pivotal events key moments resolution narrative arc",
        ],
    ),
]


def extract_content_words(text: str, exclude_terms: Optional[Set[str]] = None) -> List[str]:
    """Extract content words from text, excluding stopwords and optional book terms."""
    words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())
    excluded = STOPWORDS if exclude_terms is None else STOPWORDS | exclude_terms
    return [w for w in words if w not in excluded]


def classify_query_intent(
    question: str,
    book_terms: Optional[Set[str]] = None,
) -> Tuple[str, List[str], List[str], List[str]]:
    """
    Classifies question intent and extracts content words and substantive words.
    Returns:
        - intent: 'BROAD_SYNTHESIS' or 'SPECIFIC_FACTUAL'
        - content_words: all content words
        - substantive_words: content words minus meta-discourse scaffolding
        - expansions: list of diversified query formulations if broad/synthesis
    """
    clean_q = question.strip()
    content_words = extract_content_words(clean_q, exclude_terms=book_terms)
    substantive_words = [w for w in content_words if w not in META_DISCOURSE_WORDS]

    intent = "SPECIFIC_FACTUAL"
    expansions: List[str] = []

    for pattern, intent_name, template_expansions in BROAD_INTENT_PATTERNS:
        if pattern.search(clean_q):
            intent = "BROAD_SYNTHESIS"
            sub_entity = " ".join(substantive_words)
            for exp in template_expansions:
                expanded_q = f"{exp} {sub_entity}".strip()
                if expanded_q not in expansions:
                    expansions.append(expanded_q)
            break

    return intent, content_words, substantive_words, expansions


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


class RetrievalResult(tuple):
    """
    3-tuple subclass for backwards compatibility with `hits, sufficient, latency_ms = retriever.retrieve(...)`
    while carrying structured diagnostic metadata.
    """

    hits: List[Dict[str, Any]]
    sufficient: bool
    latency_ms: float
    strategy: str
    candidate_count: int
    refusal_reason: Optional[str]
    active_version: Optional[int]

    def __new__(
        cls,
        hits: List[Dict[str, Any]],
        sufficient: bool,
        latency_ms: float,
        strategy: str = "dense_direct",
        candidate_count: int = 0,
        refusal_reason: Optional[str] = None,
        active_version: Optional[int] = None,
    ) -> RetrievalResult:
        instance = super().__new__(cls, (hits, sufficient, latency_ms))
        instance.hits = hits
        instance.sufficient = sufficient
        instance.latency_ms = latency_ms
        instance.strategy = strategy
        instance.candidate_count = candidate_count
        instance.refusal_reason = refusal_reason
        instance.active_version = active_version
        return instance


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
    ) -> RetrievalResult:
        """
        Retrieves top-k chunks matching the question from the specified book.
        Enforces:
          - Active index version isolation
          - Intent-aware query expansion & multi-angle retrieval
          - Near-duplicate candidate suppression with cross-narrative coverage
          - Adaptive hybrid lexical-dense rescoring
          - Evaluated multi-factor evidence sufficiency check
        Returns:
            - RetrievalResult (unpacks as hits, sufficient_evidence, retrieval_latency_ms)
        """
        start_time = time.perf_counter()

        # Step 1: Validate book readiness and retrieve active version
        st = ingestion_manager.get_book_status(book_id)
        if not st or st.status != "ready" or st.chunk_count == 0:
            raise ValueError(
                f"Book '{book_id}' has not been indexed yet. Please ingest this book before starting a chat."
            )
        active_version = st.active_version

        # Step 2: Classify intent and extract terms
        book_id_words = set(book_id.lower().replace("-", " ").split())
        intent, content_words, substantive_words, expansions = classify_query_intent(
            question, book_terms=book_id_words
        )

        # Step 3: Embed primary query and execute search in Qdrant with active_version filter
        query_vector = embedder.embed_query(question)
        candidate_limit = max(top_k * 3, self.candidate_pool)

        raw_hits = vector_store.search_book(
            book_id=book_id,
            query_vector=query_vector,
            top_k=candidate_limit,
            active_version=active_version,
        )

        strategy = "dense_direct"
        all_candidate_map: Dict[str, Dict[str, Any]] = {}

        for rank, h in enumerate(raw_hits):
            cid = h["chunk_id"]
            h_copy = dict(h)
            h_copy["best_dense"] = h["score"]
            h_copy["rrf"] = 1.0 / (60.0 + rank)
            all_candidate_map[cid] = h_copy

        # Step 4: Bounded Second Retrieval with Diversified Queries if broad intent or borderline top score
        top_initial_score = raw_hits[0]["score"] if raw_hits else 0.0
        should_expand = (intent == "BROAD_SYNTHESIS") or (top_initial_score < 0.62 and bool(expansions))

        if should_expand and expansions:
            strategy = "multi_angle_synthesis" if intent == "BROAD_SYNTHESIS" else "expanded_fallback"
            # Bounded: at most 2 targeted alternative queries
            for exp_q in expansions[:2]:
                exp_vec = embedder.embed_query(exp_q)
                exp_hits = vector_store.search_book(
                    book_id=book_id,
                    query_vector=exp_vec,
                    top_k=candidate_limit,
                    active_version=active_version,
                )
                for rank, eh in enumerate(exp_hits):
                    cid = eh["chunk_id"]
                    if cid in all_candidate_map:
                        all_candidate_map[cid]["best_dense"] = max(
                            all_candidate_map[cid]["best_dense"], eh["score"]
                        )
                        all_candidate_map[cid]["rrf"] += 1.0 / (60.0 + rank)
                    else:
                        eh_copy = dict(eh)
                        eh_copy["best_dense"] = eh["score"]
                        eh_copy["rrf"] = 1.0 / (60.0 + rank)
                        all_candidate_map[cid] = eh_copy

        latency_ms = (time.perf_counter() - start_time) * 1000.0

        if not all_candidate_map:
            logger.info("Zero vector hits found for book '%s' with question '%s'", book_id, question[:40])
            return RetrievalResult(
                hits=[],
                sufficient=False,
                latency_ms=latency_ms,
                strategy=strategy,
                candidate_count=0,
                refusal_reason="zero_candidates_in_index",
                active_version=active_version,
            )

        # Step 5: Candidate Deduplication & Adaptive Hybrid Rescoring
        candidates_list = list(all_candidate_map.values())
        for c in candidates_list:
            c["score"] = c["best_dense"]
            c["dense_score"] = c["best_dense"]

        # Sort primarily by dense score, secondary by RRF consensus
        candidates_list.sort(key=lambda x: (x["dense_score"], x.get("rrf", 0)), reverse=True)

        deduped_candidates: List[Dict[str, Any]] = []
        selected_word_sets: List[Set[str]] = []

        for hit in candidates_list:
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

                dense_score = hit["dense_score"]
                # Adaptive lexical scoring: only apply lexical weighting when substantive topic words exist
                if substantive_words:
                    lexical_score = compute_lexical_score(substantive_words, hit_text)
                    hybrid_score = 0.75 * dense_score + 0.25 * lexical_score
                else:
                    lexical_score = dense_score
                    hybrid_score = dense_score

                hit["dense_score"] = dense_score
                hit["lexical_score"] = round(lexical_score, 4)
                hit["hybrid_score"] = round(hybrid_score, 4)
                hit["score"] = hybrid_score
                deduped_candidates.append(hit)

        # For broad synthesis queries, ensure cross-narrative coverage across diverse pages/chapters
        if intent == "BROAD_SYNTHESIS" and len(deduped_candidates) > top_k:
            selected_hits: List[Dict[str, Any]] = []
            seen_page_regions: Set[int] = set()

            # First pass: pick highest scoring candidates from distinct 20-page regions
            for cand in deduped_candidates:
                p_region = (cand.get("page_start") or 0) // 20
                if p_region not in seen_page_regions:
                    seen_page_regions.add(p_region)
                    selected_hits.append(cand)
                    if len(selected_hits) == top_k:
                        break

            # Second pass: fill any remaining slots with top ranked candidates
            if len(selected_hits) < top_k:
                for cand in deduped_candidates:
                    if cand not in selected_hits:
                        selected_hits.append(cand)
                        if len(selected_hits) == top_k:
                            break
            final_hits = selected_hits
        else:
            final_hits = deduped_candidates[:top_k]

        # Step 6: Evaluated Multi-Factor Evidence Sufficiency
        has_sufficient_evidence, refusal_reason = self._evaluate_evidence_sufficiency(
            intent=intent,
            content_words=content_words,
            substantive_words=substantive_words,
            final_hits=final_hits,
        )

        top_score = final_hits[0]["score"] if final_hits else 0.0
        logger.info(
            "Retrieved %d deduplicated chunks for book '%s' (strategy: %s, top hybrid: %.3f, dense: %.3f, sufficient: %s, %.1f ms)",
            len(final_hits),
            book_id,
            strategy,
            top_score,
            final_hits[0].get("dense_score", top_score) if final_hits else 0.0,
            has_sufficient_evidence,
            latency_ms,
        )

        return RetrievalResult(
            hits=final_hits,
            sufficient=has_sufficient_evidence,
            latency_ms=latency_ms,
            strategy=strategy,
            candidate_count=len(all_candidate_map),
            refusal_reason=refusal_reason,
            active_version=active_version,
        )

    def _evaluate_evidence_sufficiency(
        self,
        intent: str,
        content_words: List[str],
        substantive_words: List[str],
        final_hits: List[Dict[str, Any]],
    ) -> Tuple[bool, Optional[str]]:
        """
        Evaluates whether retrieved passages collectively contain genuine evidence to answer the question.
        Distinguishes broad synthesis questions from specific factual questions and filters out genuine noise.
        """
        if not final_hits:
            return False, "zero_candidates_retrieved"

        top_hit = final_hits[0]
        top_dense = top_hit.get("dense_score", top_hit["score"])
        mean_top3 = sum(h.get("dense_score", h["score"]) for h in final_hits[:3]) / max(1, len(final_hits[:3]))

        # Below absolute noise floor
        if top_dense < 0.52:
            return False, "below_absolute_noise_floor"

        # ── 1. Broad Synthesis Questions (turning points, themes, conflicts, character arcs) ──
        if intent == "BROAD_SYNTHESIS":
            # Multiple passages with consistent semantic alignment provide collective sufficiency
            if top_dense >= 0.57 and mean_top3 >= 0.55 and len(final_hits) >= 2:
                return True, None
            if top_dense >= self.min_similarity_score:
                return True, None
            return False, "insufficient_collective_synthesis_evidence"

        # ── 2. Specific Factual Questions ──
        # High confidence semantic match
        if top_dense >= 0.70:
            return True, None

        if substantive_words:
            all_passages_text = " ".join(h["text"].lower() for h in final_hits)
            matched_words = [w for w in substantive_words if w in all_passages_text]
            coverage = len(matched_words) / len(substantive_words)

            # If substantive topic keywords exist (e.g. 'iPhone', 'spaceship', 'Voldemort')
            # and NONE appear in any retrieved chunk, it is an unsupported entity query
            if coverage == 0.0 and top_dense < 0.68:
                return False, "missing_substantive_topic_keywords"

            # If dense score is borderline (< 0.58) and keyword coverage is weak (< 0.40)
            if top_dense < self.min_similarity_score and coverage < 0.40:
                return False, "low_keyword_and_semantic_coverage"

            return (top_dense >= self.min_similarity_score or coverage >= 0.40), None

        # Fallback when no substantive words
        if top_dense >= self.min_similarity_score:
            return True, None

        return False, "borderline_similarity_without_keyword_support"


retriever = BookRetriever()
