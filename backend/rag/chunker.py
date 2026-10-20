"""
Structure-Aware Text Chunker Module
Chunks document text with page tracking, paragraph boundary respect, and chapter detection.
Target: ~500 tokens (approx. 2000 characters) with ~80 tokens (approx. 320 characters) overlap.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import List, Optional

from .config import config
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


class StructureAwareChunker:
    """
    Chunks extracted book pages into overlapping passages while tracking
    page ranges, paragraph structures, and chapter headings.
    """

    def __init__(
        self,
        target_chars: int = config.TARGET_CHUNK_CHARS,
        overlap_chars: int = config.CHUNK_OVERLAP_CHARS,
    ) -> None:
        self.target_chars = target_chars
        self.overlap_chars = overlap_chars

    def chunk_document(self, doc: ExtractedDocument) -> List[TextChunk]:
        """
        Produce a list of TextChunk objects from an ExtractedDocument.
        Returns an empty list if document has no text.
        """
        if not doc.has_text or not doc.pages:
            return []

        # Step 1: Flatten pages into page-annotated paragraphs
        annotated_paras: List[tuple[str, int, Optional[str]]] = []
        current_chapter: Optional[str] = None

        for page in doc.pages:
            page_num = page.page_number
            raw_paras = [p.strip() for p in page.text.split("\n\n") if p.strip()]

            for p in raw_paras:
                # Check for chapter header
                lines = [line.strip() for line in p.split("\n") if line.strip()]
                if lines and CHAPTER_PATTERN.match(lines[0]):
                    current_chapter = lines[0][:80]

                # If paragraph itself is too large, split into sentences
                if len(p) > self.target_chars * 1.5:
                    sub_paras = self._split_large_paragraph(p)
                    for sp in sub_paras:
                        annotated_paras.append((sp, page_num, current_chapter))
                else:
                    annotated_paras.append((p, page_num, current_chapter))

        if not annotated_paras:
            return []

        # Step 2: Combine paragraphs into target-sized chunks with overlap
        chunks: List[TextChunk] = []
        current_buffer: List[str] = []
        current_length = 0
        current_page_start: int = annotated_paras[0][1]
        current_page_end: int = annotated_paras[0][1]
        current_chap: Optional[str] = annotated_paras[0][2]
        chunk_idx = 0

        for para_text, page_num, chap in annotated_paras:
            # If chapter changes and current buffer has substantial text, flush
            if chap != current_chap and current_length >= self.target_chars // 2:
                chunk = self._create_chunk(
                    doc.book_id,
                    chunk_idx,
                    current_buffer,
                    current_page_start,
                    current_page_end,
                    current_chap,
                )
                chunks.append(chunk)
                chunk_idx += 1
                current_buffer = []
                current_length = 0
                current_chap = chap
                current_page_start = page_num

            # Add paragraph
            current_buffer.append(para_text)
            current_length += len(para_text) + 2
            current_page_end = page_num
            if not current_chap and chap:
                current_chap = chap

            # Check if target size reached
            if current_length >= self.target_chars:
                chunk = self._create_chunk(
                    doc.book_id,
                    chunk_idx,
                    current_buffer,
                    current_page_start,
                    current_page_end,
                    current_chap,
                )
                chunks.append(chunk)
                chunk_idx += 1

                # Retain overlap from end of buffer
                current_buffer, current_length, current_page_start = self._calculate_overlap(
                    current_buffer, page_num
                )

        # Flush remaining buffer if not empty
        if current_buffer and current_length > 50:
            chunk = self._create_chunk(
                doc.book_id,
                chunk_idx,
                current_buffer,
                current_page_start,
                current_page_end,
                current_chap,
            )
            chunks.append(chunk)

        logger.info(
            "Chunked book '%s' into %d chunks (pages %d-%d)",
            doc.book_id,
            len(chunks),
            doc.pages[0].page_number if doc.pages else 0,
            doc.pages[-1].page_number if doc.pages else 0,
        )
        return chunks

    def _create_chunk(
        self,
        book_id: str,
        index: int,
        buffer: List[str],
        page_start: int,
        page_end: int,
        chapter: Optional[str],
    ) -> TextChunk:
        combined_text = "\n\n".join(buffer).strip()
        char_count = len(combined_text)
        token_count = max(1, char_count // 4)
        chunk_id = f"{book_id}_c{index:04d}_p{page_start}"
        return TextChunk(
            chunk_id=chunk_id,
            book_id=book_id,
            text=combined_text,
            page_start=page_start,
            page_end=page_end,
            chapter=chapter,
            char_count=char_count,
            token_count_est=token_count,
        )

    def _calculate_overlap(
        self, buffer: List[str], current_page: int
    ) -> tuple[List[str], int, int]:
        """Keep paragraphs from the end of buffer totaling approx overlap_chars."""
        retained: List[str] = []
        accumulated = 0
        for item in reversed(buffer):
            if accumulated + len(item) <= self.overlap_chars or not retained:
                retained.insert(0, item)
                accumulated += len(item) + 2
            else:
                break
        return retained, accumulated, current_page

    def _split_large_paragraph(self, text: str) -> List[str]:
        """Split oversized paragraph on sentence boundaries."""
        sentences = re.split(r"(?<=[.!?])\s+", text)
        result: List[str] = []
        cur: List[str] = []
        cur_len = 0
        for s in sentences:
            if cur_len + len(s) > self.target_chars and cur:
                result.append(" ".join(cur))
                cur = [s]
                cur_len = len(s)
            else:
                cur.append(s)
                cur_len += len(s) + 1
        if cur:
            result.append(" ".join(cur))
        return result
