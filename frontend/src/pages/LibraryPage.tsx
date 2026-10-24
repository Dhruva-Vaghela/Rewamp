import { useState, useEffect, useMemo, useCallback } from 'react'
import Nav from '../components/Nav'
import BookCard from '../components/BookCard'
import FloatingLibraryBackground from '../components/FloatingLibraryBackground'
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

  // Deterministic star dust particles for the enchanted hero background
  const dustParticles = useMemo(
    () => [
      { left: '10%', top: '24%', delay: '0s', duration: '7.5s', size: 3 },
      { left: '22%', top: '65%', delay: '1.5s', duration: '8.2s', size: 2.5 },
      { left: '38%', top: '30%', delay: '3.1s', duration: '9.0s', size: 3.5 },
      { left: '52%', top: '72%', delay: '0.8s', duration: '7.8s', size: 2 },
      { left: '68%', top: '28%', delay: '2.4s', duration: '8.5s', size: 3 },
      { left: '84%', top: '60%', delay: '1.2s', duration: '9.2s', size: 3.5 },
      { left: '92%', top: '35%', delay: '4.0s', duration: '8.0s', size: 2.5 },
    ],
    []
  )

  return (
    <div className="library-page">
      {/* 3D Floating Open Books Background Stage */}
      <FloatingLibraryBackground />

      <Nav />

      {/* Compact Cinematic Library Header */}
      <header className="enchanted-library-header" role="banner">
        {/* Subtle Atmospheric Light & Dust Effects */}
        <div className="enchanted-header-bg" aria-hidden="true">
          <div className="enchanted-header-beam" />
          <div className="enchanted-header-particles">
            {dustParticles.map((p, i) => (
              <span
                key={i}
                className="enchanted-dust-mote"
                style={{
                  left: p.left,
                  top: p.top,
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  animationDelay: p.delay,
                  animationDuration: p.duration,
                }}
              />
            ))}
          </div>
          <div className="enchanted-header-vignette" />
        </div>

        <div className="enchanted-header-inner">
          <div className="enchanted-header-top">
            <div className="enchanted-title-group">
              <div className="library-eyebrow">
                <span className="eyebrow-symbol" aria-hidden="true">✦</span>
                <span className="eyebrow-text">THE REWAMP COLLECTION</span>
                <span className="eyebrow-symbol" aria-hidden="true">✦</span>
              </div>
              <h1 className="enchanted-library-title">Choose Your Next World</h1>
              <p className="enchanted-library-description">
                Explore timeless stories, uncover hidden secrets, and discover more within every page.
              </p>
            </div>

            {/* Ingestion & Status Controls */}
            <div className="enchanted-actions-group">
              <div
                className="library-index-badge"
                title={`${readyCount} of ${books.length} volumes indexed into Qdrant Cloud`}
              >
                <span
                  className="index-badge-gem"
                  style={{ background: readyCount === books.length && books.length > 0 ? '#10b981' : '#f59e0b' }}
                />
                <span className="index-badge-text">
                  {readyCount} of {books.length} Ready
                </span>
              </div>

              <button
                className="btn-enchanted-action"
                onClick={handleIngestAll}
                disabled={ingestingAll || (readyCount === books.length && books.length > 0)}
                id="library-ingest-all-btn"
                title="Index all volumes into Qdrant Cloud for AI retrieval"
              >
                {ingestingAll ? (
                  <>
                    <span className="spinner-mini" style={{ width: 12, height: 12 }} />
                    <span>Indexing Volumes…</span>
                  </>
                ) : (
                  <>
                    <span className="btn-glyph" aria-hidden="true">⚡</span>
                    <span>{readyCount === books.length && books.length > 0 ? 'All Indexed' : 'Index All'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Fantasy Search & Discovery Bar */}
          <div className="enchanted-discovery-bar">
            <div
              className="fantasy-search-field"
              role="search"
              aria-label="Search library catalog"
            >
              <span className="fantasy-search-icon" aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
              </span>
              <input
                id="library-search-input"
                type="search"
                className="fantasy-search-input"
                placeholder="Search by title or author…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search books by title or author"
                autoComplete="off"
                spellCheck={false}
              />
              {query && (
                <button
                  type="button"
                  className="fantasy-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear search query"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {status === 'success' && (
              <div className="collection-count-badge" aria-live="polite" aria-atomic="true">
                <span className="count-number">{filtered.length}</span>
                <span className="count-label">
                  {filtered.length === 1 ? 'Volume' : 'Volumes'} {query ? 'Matched' : 'Available'}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Library Showcase */}
      <main className="library-content" id="library-main-content">
        {/* Loading State */}
        {status === 'loading' && (
          <div className="enchanted-state-container" role="status" aria-label="Loading library collection">
            <div className="enchanted-spinner" />
            <h2 className="state-title">Opening the Grand Vault…</h2>
            <p className="state-subtitle">Illuminating the archives and gathering your volumes.</p>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="enchanted-state-container state-error" role="alert">
            <div className="state-ornament" aria-hidden="true">⚠️</div>
            <h2 className="state-title">The Vault is Sealed</h2>
            <p className="state-subtitle">
              {errorMsg || 'Unable to reach the catalog archives. Verify that the server backend is running on port 8000.'}
            </p>
            <button
              className="btn btn-secondary"
              style={{ marginTop: 24 }}
              onClick={() => window.location.reload()}
              id="library-retry-btn"
            >
              Retry Access
            </button>
          </div>
        )}

        {/* Empty Search State */}
        {status === 'success' && filtered.length === 0 && query && (
          <div className="enchanted-empty-state" role="status">
            <div className="empty-state-symbol" aria-hidden="true">📜</div>
            <h2 className="empty-state-title">No Volumes Found</h2>
            <p className="empty-state-subtitle">
              No manuscripts match <span className="highlight-query">"{query}"</span> in this collection.
            </p>
            <button
              className="btn-enchanted-action btn-clear-filter"
              onClick={() => setQuery('')}
              id="library-clear-search-btn"
            >
              <span>✦ Show All Volumes</span>
            </button>
          </div>
        )}

        {/* Empty Library State */}
        {status === 'success' && books.length === 0 && (
          <div className="enchanted-empty-state" role="status">
            <div className="empty-state-symbol" aria-hidden="true">📚</div>
            <h2 className="empty-state-title">The Library Awaits Its First Book</h2>
            <p className="empty-state-subtitle">
              Deposit PDF volumes into <code>backend/data/books/</code> to unveil them here.
            </p>
          </div>
        )}

        {/* 8-Volume Books Grid */}
        {status === 'success' && filtered.length > 0 && (
          <section aria-label={`${filtered.length} volumes in the Rewamp collection`}>
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
