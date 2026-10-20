import { useState, useEffect, useMemo } from 'react'
import Nav from '../components/Nav'
import BookCard from '../components/BookCard'
import { fetchBooks } from '../api/books'
import { BookSummary } from '../types'

type Status = 'loading' | 'success' | 'error'

export default function LibraryPage() {
  const [books, setBooks] = useState<BookSummary[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    fetchBooks()
      .then((data) => {
        if (!cancelled) {
          setBooks(data)
          setStatus('success')
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
          setStatus('error')
        }
      })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return books
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q)
    )
  }, [books, query])

  return (
    <div className="library-page">
      <Nav />

      {/* Library header */}
      <header className="library-header">
        <div className="library-header-glow" aria-hidden="true" />
        <div className="library-header-inner">
          <h1 className="library-title">Your Library</h1>
          <p className="library-subtitle">
            A curated collection of classic literature, ready to read.
          </p>

          {/* Search */}
          <div
            className="library-search-bar"
            role="search"
            aria-label="Search books"
          >
            <span className="library-search-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            </span>
            <input
              id="library-search-input"
              type="search"
              className="library-search-input"
              placeholder="Search by title or author…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search books by title or author"
              autoComplete="off"
              spellCheck={false}
            />
            {status === 'success' && (
              <span className="library-count" aria-live="polite" aria-atomic="true">
                {filtered.length} / {books.length}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="library-content">
        {/* Loading */}
        {status === 'loading' && (
          <div className="state-container" role="status" aria-label="Loading library">
            <div className="spinner" />
            <h2 className="state-title">Loading your library…</h2>
            <p className="state-subtitle">Fetching your book collection.</p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="state-container" role="alert">
            <div className="state-icon">⚠️</div>
            <h2 className="state-title">Could not load library</h2>
            <p className="state-subtitle">
              {errorMsg
                ? errorMsg
                : 'Unable to reach the catalog server. Make sure the backend is running on port 8000.'}
            </p>
            <button
              className="btn btn-secondary"
              style={{ marginTop: 24 }}
              onClick={() => window.location.reload()}
              id="library-retry-btn"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty search result */}
        {status === 'success' && filtered.length === 0 && query && (
          <div className="state-container" role="status">
            <div className="state-icon">🔍</div>
            <h2 className="state-title">No books found</h2>
            <p className="state-subtitle">
              No books match "{query}". Try a different title or author name.
            </p>
            <button
              className="btn btn-secondary"
              style={{ marginTop: 24 }}
              onClick={() => setQuery('')}
              id="library-clear-search-btn"
            >
              Clear Search
            </button>
          </div>
        )}

        {/* Empty library */}
        {status === 'success' && books.length === 0 && (
          <div className="state-container" role="status">
            <div className="state-icon">📚</div>
            <h2 className="state-title">Your library is empty</h2>
            <p className="state-subtitle">
              Add PDF files to <code>backend/data/books/</code> and restart the server to see them here.
            </p>
          </div>
        )}

        {/* Book grid */}
        {status === 'success' && filtered.length > 0 && (
          <section aria-label={`${filtered.length} book${filtered.length !== 1 ? 's' : ''} in library`}>
            <div className="books-grid" id="books-grid">
              {filtered.map((book) => (
                <BookCard key={book.id} book={book} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
