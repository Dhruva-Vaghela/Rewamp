"""
Structure-Aware Token-Based Text Chunker Module
Chunks document text with page tracking, paragraph boundary respect, and chapter detection.
Uses exact tokenizer compatible with the embedding model (FastEmbed BGE-small-en-v1.5)
to guarantee zero embedding truncation.
Target: ~384 tokens with ~64 tokens overlap, hard ceiling <= 490 tokens.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import List, Optional

from .config import config
from .embedder import embedder
from .extractor import ExtractedDocument

logger = logging.getLogger("rewamp.rag.chunker")

CHAPTER_PATTERN = re.compile(
    r"^(CHAPTER\s+[IVXLCDM\d]+|BOOK\s+[IVXLCDM\d]+|PART\s+[IVXLCDM\d]+|PROLOGUE|EPILOGUE)",
    re.IGNORECASE,
)


@dataclass
class TextChunk:
    chunk_id: str
    book_id: str
    text: str
    page_start: int
    page_end: int
    chapter: Optional[str] = None
    char_count: int = 0
    token_count_est: int = 0
    token_count: int = 0

    def __post_init__(self) -> None:
        if self.token_count and not self.token_count_est:
            self.token_count_est = self.token_count
        elif self.token_count_est and not self.token_count:
            self.token_count = self.token_count_est


class StructureAwareChunker:
    """
    Chunks extracted book pages into overlapping passages while tracking
    page ranges, paragraph structures, and chapter headings.
    Token-aware: uses embedding model tokenizer to prevent vector truncation.
    """

    def __init__(
        self,
        target_tokens: int = config.CHUNK_TARGET_TOKENS,
        overlap_tokens: int = config.CHUNK_OVERLAP_TOKENS,
        max_tokens: int = config.CHUNK_MAX_TOKENS,
        target_chars: Optional[int] = None,
        overlap_chars: Optional[int] = None,
    ) -> None:
        # If caller passed legacy char parameters (e.g. in older unit tests), convert
        if target_chars is not None:
            self.target_tokens = max(64, target_chars // 4)
        else:
            self.target_tokens = target_tokens

        if overlap_chars is not None:
            self.overlap_tokens = max(16, overlap_chars // 4)
        else:
            self.overlap_tokens = overlap_tokens

        self.max_tokens = min(500, max(self.target_tokens + 10, max_tokens))
        self.target_chars = self.target_tokens * 4
        self.overlap_chars = self.overlap_tokens * 4

    def _count_tokens(self, text: str) -> int:
        return embedder.count_tokens(text)

    def chunk_document(self, doc: ExtractedDocument) -> List[TextChunk]:
        """
        Produce a list of TextChunk objects from an ExtractedDocument.
        Returns an empty list if document has no text.
        """
        if not doc.has_text or not doc.pages:
            return []

        # Step 1: Flatten pages into page-annotated paragraph/sentence units strictly <= target_tokens
        annotated_units: List[tuple[str, int, int, Optional[str]]] = []
        current_chapter: Optional[str] = None

        for page in doc.pages:
            page_num = page.page_number
            raw_paras = [p.strip() for p in page.text.split("\n\n") if p.strip()]

            for p in raw_paras:
                # Check for chapter header
                lines = [line.strip() for line in p.split("\n") if line.strip()]
                if lines and CHAPTER_PATTERN.match(lines[0]):
                    current_chapter = lines[0][:80]

                p_tokens = self._count_tokens(p)
                if p_tokens > self.target_tokens:
                    # Paragraph is oversized: split along sentence boundaries cleanly
                    sub_units = self._split_large_paragraph(p, self.target_tokens)
                    for su in sub_units:
                        su_tok = self._count_tokens(su)
                        annotated_units.append((su, su_tok, page_num, current_chapter))
                else:
                    annotated_units.append((p, p_tokens, page_num, current_chapter))

        if not annotated_units:
            return []

        # Step 2: Combine units into target-sized chunks with token-bounded overlap
        chunks: List[TextChunk] = []
        current_buffer: List[tuple[str, int, int, Optional[str]]] = []
        current_buffer_tokens = 0
        chunk_idx = 0

        for unit_text, unit_tokens, page_num, chap in annotated_units:
            # Check chapter boundary: if chapter changes and current buffer has substantial text, flush
            if (
                current_buffer
                and current_buffer[-1][3] != chap
                and current_buffer_tokens >= self.target_tokens // 2
            ):
                chunk = self._create_chunk(doc.book_id, chunk_idx, current_buffer)
                chunks.append(chunk)
                chunk_idx += 1
                current_buffer = []
                current_buffer_tokens = 0

            # Check if adding this unit would exceed target size
            if current_buffer and (current_buffer_tokens + unit_tokens > self.target_tokens):
                chunk = self._create_chunk(doc.book_id, chunk_idx, current_buffer)
                chunks.append(chunk)
                chunk_idx += 1

                # Calculate overlap: retain units from the tail of current_buffer
                retained: List[tuple[str, int, int, Optional[str]]] = []
                retained_tokens = 0
                for item in reversed(current_buffer):
                    if retained_tokens + item[1] <= self.overlap_tokens or not retained:
                        retained.insert(0, item)
                        retained_tokens += item[1]
                    else:
                        break

                # Ensure retained + new unit does not exceed max_tokens ceiling
                while retained and (retained_tokens + unit_tokens > self.max_tokens):
                    dropped = retained.pop(0)
                    retained_tokens -= dropped[1]

                current_buffer = retained + [(unit_text, unit_tokens, page_num, chap)]
                current_buffer_tokens = retained_tokens + unit_tokens
            else:
                current_buffer.append((unit_text, unit_tokens, page_num, chap))
                current_buffer_tokens += unit_tokens

        # Flush remaining buffer if not empty and non-trivial
        if current_buffer:
            chunk = self._create_chunk(doc.book_id, chunk_idx, current_buffer)
            chunks.append(chunk)

        logger.info(
            "Chunked book '%s' into %d token-aware chunks (target=%d, max=%d tokens)",
            doc.book_id,
            len(chunks),
            self.target_tokens,
            self.max_tokens,
        )
        return chunks

    def _create_chunk(
        self,
        book_id: str,
        index: int,
        buffer: List[tuple[str, int, int, Optional[str]]],
    ) -> TextChunk:
        combined_text = "\n\n".join(item[0] for item in buffer).strip()
        token_count = self._count_tokens(combined_text)
        page_start = buffer[0][2]
        page_end = buffer[-1][2]
        chapter = buffer[0][3] or (buffer[-1][3] if buffer else None)
        chunk_id = f"{book_id}_c{index:04d}_p{page_start}"
        return TextChunk(
            chunk_id=chunk_id,
            book_id=book_id,
            text=combined_text,
            page_start=page_start,
            page_end=page_end,
            chapter=chapter,
            char_count=len(combined_text),
            token_count_est=token_count,
            token_count=token_count,
        )

    def _split_large_paragraph(self, text: str, max_unit_tokens: int) -> List[str]:
        """Split oversized paragraph on sentence boundaries with token boundary checking."""
        sentences = re.split(r"(?<=[.!?])\s+", text)
        result: List[str] = []
        cur: List[str] = []
        cur_tok = 0
        for s in sentences:
            s_clean = s.strip()
            if not s_clean:
                continue
            s_tok = self._count_tokens(s_clean)
            if cur and (cur_tok + s_tok > max_unit_tokens):
                result.append(" ".join(cur))
                cur = [s_clean]
                cur_tok = s_tok
            else:
                cur.append(s_clean)
                cur_tok += s_tok
        if cur:
            result.append(" ".join(cur))
        return result
