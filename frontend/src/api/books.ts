import { BookSummary, BookDetail } from '../types'

const API_BASE = '/api'

export async function fetchBooks(): Promise<BookSummary[]> {
  const res = await fetch(`${API_BASE}/books`)
  if (!res.ok) throw new Error(`Failed to fetch books: ${res.status} ${res.statusText}`)
  return res.json()
}

export async function fetchBook(bookId: string): Promise<BookDetail> {
  const res = await fetch(`${API_BASE}/books/${encodeURIComponent(bookId)}`)
  if (!res.ok) throw new Error(`Failed to fetch book: ${res.status} ${res.statusText}`)
  return res.json()
}

/** Returns the URL to stream the PDF — validated by book ID on the server. */
export function getPdfUrl(bookId: string): string {
  return `${API_BASE}/books/${encodeURIComponent(bookId)}/pdf`
}

/** Returns the URL to fetch the rendered front cover of the book. */
export function getCoverUrl(bookId: string): string {
  return `${API_BASE}/books/${encodeURIComponent(bookId)}/cover`
}

