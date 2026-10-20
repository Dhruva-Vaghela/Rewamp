"""
PDF Text Extraction Module
Extracts high-fidelity page-level text from PDFs using PyMuPDF.
Detects empty documents, scanned PDFs with no extractable text, and page boundaries.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

import pymupdf

logger = logging.getLogger("rewamp.rag.extractor")


@dataclass
class ExtractedPage:
    page_number: int  # 1-indexed
    text: str
    char_count: int


@dataclass
class ExtractedDocument:
    book_id: str
    filename: str
    total_pages: int
    pages: List[ExtractedPage] = field(default_factory=list)
    has_text: bool = True
    is_scanned: bool = False
    error: Optional[str] = None


class PdfExtractor:
    """Extracts text page-by-page from PDF documents."""

    @staticmethod
    def extract(book_id: str, pdf_path: Path) -> ExtractedDocument:
        if not pdf_path.is_file():
            return ExtractedDocument(
                book_id=book_id,
                filename=pdf_path.name,
                total_pages=0,
                has_text=False,
                error=f"PDF file not found: {pdf_path.name}",
            )

        try:
            doc = pymupdf.open(str(pdf_path))
        except Exception as exc:
            logger.error("Failed to open PDF %s: %s", pdf_path.name, exc)
            return ExtractedDocument(
                book_id=book_id,
                filename=pdf_path.name,
                total_pages=0,
                has_text=False,
                error=f"Could not open PDF file: {exc}",
            )

        total_pages = len(doc)
        if total_pages == 0:
            doc.close()
            return ExtractedDocument(
                book_id=book_id,
                filename=pdf_path.name,
                total_pages=0,
                has_text=False,
                error="PDF document contains zero pages",
            )

        extracted_pages: List[ExtractedPage] = []
        total_chars = 0

        try:
            for page_idx in range(total_pages):
                page = doc[page_idx]
                page_text = page.get_text("text") or ""
                # Clean up null characters or excess carriage returns
                clean_text = page_text.replace("\x00", "").strip()

                page_num = page_idx + 1
                char_count = len(clean_text)
                total_chars += char_count

                if clean_text:
                    extracted_pages.append(
                        ExtractedPage(
                            page_number=page_num,
                            text=clean_text,
                            char_count=char_count,
                        )
                    )
        except Exception as exc:
            logger.error("Error extracting text from %s: %s", pdf_path.name, exc)
            doc.close()
            return ExtractedDocument(
                book_id=book_id,
                filename=pdf_path.name,
                total_pages=total_pages,
                has_text=False,
                error=f"Text extraction failed: {exc}",
            )
        finally:
            doc.close()

        # Check for scanned or empty document
        if total_chars < 50:
            # Document has virtually no text; either blank or scanned image
            logger.warning(
                "PDF %s has %d pages but only %d characters. Likely scanned or blank.",
                pdf_path.name,
                total_pages,
                total_chars,
            )
            return ExtractedDocument(
                book_id=book_id,
                filename=pdf_path.name,
                total_pages=total_pages,
                pages=extracted_pages,
                has_text=False,
                is_scanned=True,
                error="PDF contains no extractable text. The document appears to be scanned or image-based, requiring OCR.",
            )

        return ExtractedDocument(
            book_id=book_id,
            filename=pdf_path.name,
            total_pages=total_pages,
            pages=extracted_pages,
            has_text=True,
            is_scanned=False,
        )
