// API types matching the backend schema

export interface BookSummary {
  id: string
  title: string
  author: string
  page_count: number | null
  size_bytes: number
  cover_url?: string
}


export interface BookDetail extends BookSummary {
  filename: string
}

export type Theme = 'dark' | 'light' | 'system'
