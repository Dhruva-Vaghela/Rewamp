import { useState, useEffect, useMemo, useCallback } from 'react'
import Nav from '../components/Nav'
import BookCard from '../components/BookCard'
import { fetchBooks, triggerIngestAll } from '../api/books'
import { BookSummary } from '../types'

type Status = 'loading' | 'success' | 'error'

export default function LibraryPage() {
  const [books, setBooks] = useState<BookSummary[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [query, setQuery] = useState('')
  const [ingestingAll, setIngestingAll] = useState(false)

  const loadData = useCallback(() => {
    fetchBooks()
      .then((data) => {
        setBooks(data)
        setStatus('success')
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
        setStatus('error')
      })
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Periodic poll if any book is currently processing
  useEffect(() => {
    const hasProcessing = books.some((b) => b.ingest_status === 'processing')
    if (!hasProcessing && !ingestingAll) return

    const interval = setInterval(() => {
      fetchBooks()
        .then((data) => {
          setBooks(data)
          if (!data.some((b) => b.ingest_status === 'processing')) {
            setIngestingAll(false)
          }
        })
        .catch(console.error)
    }, 4000)

    return () => clearInterval(interval)
  }, [books, ingestingAll])

  const handleIngestAll = async () => {
    if (ingestingAll) return
    setIngestingAll(true)
    try {
      await triggerIngestAll()
      loadData()
    } catch (err) {
      console.error('Failed to start bulk ingestion:', err)
      setIngestingAll(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return books
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q)
    )
  }, [books, query])

  const readyCount = useMemo(() => {
    return books.filter((b) => b.ingest_status === 'ready').length
  }, [books])

  return (
    <div className="library-page">
      <Nav />

      {/* Library header */}
      <header className="library-header">
        <div className="library-header-glow" aria-hidden="true" />
        <div className="library-header-inner">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 className="library-title">Your Library</h1>
              <p className="library-subtitle">
                A curated collection of classic literature, ready to read and explore with AI.
              </p>
            </div>

            {/* Ingest All Action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: readyCount > 0 ? '#10b981' : '#f59e0b' }} />
                <span>{readyCount} of {books.length} Books Indexed</span>
              </div>

              <button
                className="btn btn-secondary"
                onClick={handleIngestAll}
                disabled={ingestingAll || (readyCount === books.length && books.length > 0)}
                id="library-ingest-all-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 16px' }}
                title="Index all books into Qdrant Cloud for AI retrieval"
              >
                {ingestingAll ? (
                  <>
                    <span className="spinner-mini" style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    <span>Indexing All Books…</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>{readyCount === books.length && books.length > 0 ? 'All Indexed' : 'Index All for AI'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Search */}
          <div
            className="library-search-bar"
            role="search"
            aria-label="Search books"
            style={{ marginTop: 24 }}
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
                <BookCard key={book.id} book={book} onStatusChange={loadData} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
