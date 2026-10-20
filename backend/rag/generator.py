"""
Grounded Answer Generation with Groq LLM
Formats retrieved book passages into an untrusted-evidence context,
calls the Groq chat completions API, maps citations to original chunks,
and handles errors without fabricating answers.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from groq import Groq

from .config import config
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
    # Collapse multiple inline spaces
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    # Normalize excessive newlines
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


class AnswerGenerator:
    """Generates grounded answers using Groq's official Python SDK."""

    def __init__(self) -> None:
        self.api_key = config.GROQ_API_KEY
        self.timeout = config.GROQ_TIMEOUT_SECONDS

    def _get_groq_client(self) -> Groq:
        if not self.api_key:
            raise ValueError(
                "Groq API key is not configured. Please ensure GROQ_API_KEY is defined in the backend .env file."
            )
        return Groq(api_key=self.api_key, timeout=self.timeout)

    def generate_answer(
        self,
        book_title: str,
        question: str,
        retrieved_chunks: List[Dict[str, Any]],
        has_sufficient_evidence: bool,
    ) -> Tuple[str, List[Citation], bool, float, str]:
        """
        Calls Groq to generate a grounded answer from retrieved chunks.
        Returns:
            - answer text (str)
            - citations list (List[Citation])
            - is_grounded (bool)
            - generation_latency_ms (float)
            - model_used (str)
        """
        start_time = time.perf_counter()
        model = config.get_supported_groq_model()

        # If zero chunks or completely insufficient evidence detected prior to generation
        if not retrieved_chunks or not has_sufficient_evidence:
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            return (
                f"The text of {book_title} does not contain sufficient information to answer '{question}'.",
                [],
                False,
                latency_ms,
                model,
            )

        # Build context from chunks
        context_parts: List[str] = []
        citations_map: Dict[int, Citation] = {}

        for idx, chunk in enumerate(retrieved_chunks, start=1):
            source_tag = f"Source {idx}"
            page_info = f"Pages {chunk['page_start']}-{chunk['page_end']}" if chunk['page_start'] != chunk['page_end'] else f"Page {chunk['page_start']}"
            chapter_info = f" | {chunk['chapter']}" if chunk.get("chapter") else ""

            # Excerpt for citation card (first 280 chars)
            clean_excerpt = chunk["text"][:300].strip().replace("\n", " ") + ("..." if len(chunk["text"]) > 300 else "")

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

            context_parts.append(
                f"--- [{source_tag}] ({page_info}{chapter_info}) ---\n{chunk['text']}\n"
            )

        context_str = "\n".join(context_parts)

        user_content = f"""Book Title: {book_title}

Retrieved Book Excerpts:
{context_str}

User Question: {question}

Please answer the question directly in normal, conversational plain text (no markdown bold or asterisks), noting [Source N] for cited facts."""

        try:
            client = self._get_groq_client()
            logger.info("Sending prompt to Groq model '%s' (%d context chunks)", model, len(retrieved_chunks))

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

            # Detect which citations were actually referenced or return all retrieved evidence
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
                final_citations = list(citations_map.values())

            # Check if answer acknowledged insufficient information
            lower_ans = raw_answer.lower()
            not_enough_info = (
                "not enough information" in lower_ans
                or "does not contain" in lower_ans
                or "insufficient information" in lower_ans
                or "does not mention" in lower_ans
            )

            is_grounded = not not_enough_info

            # Clean prose of [Source N] tags, bold asterisks, and robotic intros
            clean_prose = clean_answer_text(raw_answer)

            return clean_prose, final_citations, is_grounded, latency_ms, model

        except Exception as exc:
            logger.error("Groq answer generation failed: %s", exc)
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            # Report clear error without leaking API key
            err_text = str(exc)
            if "api_key" in err_text.lower():
                err_text = "Authentication error: Please check that GROQ_API_KEY in .env is valid."
            raise RuntimeError(f"Groq generation error: {err_text}") from exc


generator = AnswerGenerator()
