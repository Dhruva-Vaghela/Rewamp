// API types matching the backend schema and RAG contracts

export interface BookSummary {
  id: string
  title: string
  author: string
  page_count: number | null
  size_bytes: number
  cover_url?: string
  ingest_status?: 'pending' | 'processing' | 'ready' | 'failed'
  chunk_count?: number
}

export interface BookDetail extends BookSummary {
  filename: string
}

export type Theme = 'dark' | 'light' | 'system'

// --- RAG & Chat Interfaces ---

export interface Citation {
  source_id: number
  chunk_id: string
  book_id: string
  page_start: number
  page_end: number
  chapter?: string | null
  excerpt: string
  score: number
}

export interface DiagnosticChunk {
  chunk_id: string
  page_start: number
  page_end: number
  chapter?: string | null
  score: number
  text: string
}

export interface Diagnostics {
  retrieval_time_ms: number
  generation_time_ms: number
  total_time_ms: number
  model: string
  embedding_model: string
  chunks_retrieved: number
  sufficient_evidence: boolean
  retrieved_chunks: DiagnosticChunk[]
}

export interface ChatResponse {
  book_id: string
  question: string
  answer: string
  citations: Citation[]
  is_grounded: boolean
  sufficient_evidence: boolean
  diagnostics?: Diagnostics
}

export interface ChatMessage {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: string
  citations?: Citation[]
  is_grounded?: boolean
  sufficient_evidence?: boolean
  diagnostics?: Diagnostics
  error?: string
}

export interface BookIngestStatus {
  book_id: string
  title: string
  status: 'pending' | 'processing' | 'ready' | 'failed'
  chunk_count: number
  file_hash?: string | null
  error?: string | null
  updated_at?: string | null
}

export interface IngestJobProgress {
  job_id: string
  status: 'pending' | 'running' | 'completed' | 'completed_with_errors' | 'failed'
  total_books: number
  processed_books: number
  current_book?: string | null
  errors: string[]
  completed_at?: string | null
}
