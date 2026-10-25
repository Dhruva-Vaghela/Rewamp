import {
  BookSummary,
  BookDetail,
  BookIngestStatus,
  ChatResponse,
  IngestJobProgress,
} from '../types'

/**
 * Normalizes the API base URL:
 * - Uses import.meta.env.VITE_API_BASE_URL when defined (e.g. https://rewamp-library.onrender.com or https://rewamp-library.onrender.com/api).
 * - Falls back to '/api' when unset so local development through the Vite proxy continues to work seamlessly.
 */
function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
  if (!envUrl) {
    return '/api'
  }
  const clean = envUrl.replace(/\/+$/, '')
  return clean.endsWith('/api') ? clean : `${clean}/api`
}

export const API_BASE = getApiBaseUrl()

/**
 * Resolves a backend resource path or URL (e.g., covers, PDFs) against the configured backend origin.
 * In local dev (unset VITE_API_BASE_URL), relative paths like '/api/books/...' are preserved for the Vite proxy.
 * In production (configured VITE_API_BASE_URL), relative paths resolve to the absolute Render backend URL.
 */
export function resolveResourceUrl(urlOrPath?: string | null): string {
  if (!urlOrPath) return ''

  // If already absolute (http://, https://, data:, blob:), return as-is
  if (/^(?:https?:|\/\/|data:|blob:)/i.test(urlOrPath)) {
    return urlOrPath
  }

  // If API_BASE is an absolute URL (e.g. https://rewamp-library.onrender.com/api)
  if (/^https?:\/\//i.test(API_BASE)) {
    try {
      const url = new URL(API_BASE)
      const path = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`
      return `${url.origin}${path}`
    } catch {
      return urlOrPath
    }
  }

  return urlOrPath
}

export async function fetchBooks(): Promise<BookSummary[]> {
  const res = await fetch(`${API_BASE}/books`)
  if (!res.ok) throw new Error(`Failed to fetch books: ${res.status} ${res.statusText}`)
  const books: BookSummary[] = await res.json()
  return books.map((book) => ({
    ...book,
    cover_url: resolveResourceUrl(book.cover_url) || getCoverUrl(book.id),
  }))
}

export async function fetchBook(bookId: string): Promise<BookDetail> {
  const res = await fetch(`${API_BASE}/books/${encodeURIComponent(bookId)}`)
  if (!res.ok) throw new Error(`Failed to fetch book: ${res.status} ${res.statusText}`)
  const book: BookDetail = await res.json()
  return {
    ...book,
    cover_url: resolveResourceUrl(book.cover_url) || getCoverUrl(book.id),
  }
}

/** Returns the URL to stream the PDF — validated by book ID on the server. */
export function getPdfUrl(bookId: string): string {
  return `${API_BASE}/books/${encodeURIComponent(bookId)}/pdf`
}

/** Returns the URL to fetch the rendered front cover of the book. */
export function getCoverUrl(bookId: string): string {
  return `${API_BASE}/books/${encodeURIComponent(bookId)}/cover`
}

// --- RAG & Chat API Calls ---

export async function fetchIngestStatuses(): Promise<BookIngestStatus[]> {
  const res = await fetch(`${API_BASE}/rag/books`)
  if (!res.ok) throw new Error(`Failed to fetch ingestion statuses: ${res.statusText}`)
  return res.json()
}

export async function fetchBookIngestStatus(bookId: string): Promise<BookIngestStatus> {
  const res = await fetch(`${API_BASE}/rag/books/${encodeURIComponent(bookId)}/status`)
  if (!res.ok) throw new Error(`Failed to fetch book status: ${res.statusText}`)
  return res.json()
}

export async function triggerBookIngest(bookId: string): Promise<{ job_id: string; message: string }> {
  const res = await fetch(`${API_BASE}/rag/ingest/${encodeURIComponent(bookId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.detail || `Ingestion request failed (${res.status})`)
  }
  return res.json()
}

export async function triggerIngestAll(): Promise<{ job_id: string; message: string }> {
  const res = await fetch(`${API_BASE}/rag/ingest-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.detail || `Ingest all request failed (${res.status})`)
  }
  return res.json()
}

export async function fetchJobProgress(jobId: string): Promise<IngestJobProgress> {
  const res = await fetch(`${API_BASE}/rag/jobs/${encodeURIComponent(jobId)}`)
  if (!res.ok) throw new Error(`Failed to poll job status: ${res.statusText}`)
  return res.json()
}

export async function sendChatMessage(
  bookId: string,
  question: string,
  topK: number = 5
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ book_id: bookId, question, top_k: topK }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Chat request failed with status ${res.status}`)
  }

  return res.json()
}
