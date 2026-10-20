import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookSummary } from '../types'
import { getCoverUrl, triggerBookIngest } from '../api/books'

// A palette of rich cover gradients and tints for fallback covers
const COVER_PALETTES = [
  { bg: 'linear-gradient(160deg, #1a0a2e 0%, #2d1250 100%)', textColor: '#e8d5ff', spineColor: '#4a1f8a', ornament: '✦' },
  { bg: 'linear-gradient(160deg, #0a1a12 0%, #1c4232 100%)', textColor: '#c8e8d8', spineColor: '#1c5a30', ornament: '❧' },
  { bg: 'linear-gradient(160deg, #1a0a08 0%, #3d1a10 100%)', textColor: '#f0d8c8', spineColor: '#6b2010', ornament: '☙' },
  { bg: 'linear-gradient(160deg, #0a0e1a 0%, #1a2b4a 100%)', textColor: '#c8d8f8', spineColor: '#1a3060', ornament: '✧' },
  { bg: 'linear-gradient(160deg, #1a1208 0%, #3d2c10 100%)', textColor: '#f8e8c0', spineColor: '#6b4a0a', ornament: '✾' },
  { bg: 'linear-gradient(160deg, #0a1a1a 0%, #1a3a3a 100%)', textColor: '#b8e8e8', spineColor: '#1a5050', ornament: '❊' },
  { bg: 'linear-gradient(160deg, #1a0f1a 0%, #3a2040 100%)', textColor: '#e8c8e8', spineColor: '#5a2a6a', ornament: '✦' },
  { bg: 'linear-gradient(160deg, #0f1a0a 0%, #243a18 100%)', textColor: '#d4e8c0', spineColor: '#2a5a14', ornament: '❧' },
]

function getPalette(title: string) {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0
  }
  return COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface BookCardProps {
  book: BookSummary
  onStatusChange?: () => void
}

export default function BookCard({ book, onStatusChange }: BookCardProps) {
  const [coverLoaded, setCoverLoaded] = useState(false)
  const [coverError, setCoverError] = useState(false)
  const [ingesting, setIngesting] = useState(book.ingest_status === 'processing')
  const navigate = useNavigate()

  const palette = getPalette(book.title)
  const coverUrl = book.cover_url || getCoverUrl(book.id)
  const isReady = book.ingest_status === 'ready'

  const handleIngestClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (ingesting || isReady) return

    setIngesting(true)
    try {
      await triggerBookIngest(book.id)
      if (onStatusChange) onStatusChange()
    } catch (err) {
      console.error('Failed to trigger ingestion:', err)
      setIngesting(false)
    }
  }

  return (
    <div
      className="book-card"
      id={`book-card-${book.id}`}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {/* Cover container */}
      <div
        className="book-card-cover"
        onClick={() => navigate(isReady ? `/chat/${encodeURIComponent(book.id)}` : `/read/${encodeURIComponent(book.id)}`)}
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        <div className="book-card-cover-visual">
          {!coverError ? (
            <>
              {!coverLoaded && (
                <div className="book-cover-skeleton" aria-hidden="true">
                  <div className="skeleton-shimmer" />
                </div>
              )}
              <img
                src={coverUrl}
                alt={`Front cover of ${book.title}`}
                loading="lazy"
                decoding="async"
                className={`book-cover-img ${coverLoaded ? 'is-loaded' : ''}`}
                onLoad={() => setCoverLoaded(true)}
                onError={() => {
                  console.warn(`Cover failed to load for book '${book.id}', falling back to decorative cover.`)
                  setCoverError(true)
                }}
              />
            </>
          ) : (
            /* Polished Fallback Cover */
            <div
              className="book-fallback-cover"
              style={{ background: palette.bg, color: palette.textColor }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '6px',
                  background: palette.spineColor,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  right: '12px',
                  height: '1px',
                  background: `${palette.textColor}30`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  right: '12px',
                  height: '1px',
                  background: `${palette.textColor}30`,
                }}
              />
              <div className="book-fallback-ornament" style={{ color: palette.textColor }}>
                {palette.ornament}
              </div>
              <div className="book-fallback-title" style={{ color: palette.textColor }}>
                {book.title}
              </div>
              <div className="book-fallback-author" style={{ color: palette.textColor }}>
                {book.author}
              </div>
            </div>
          )}
        </div>

        {/* Ingestion Status Badge */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 4,
          }}
        >
          {isReady ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(16, 185, 129, 0.9)',
                color: '#ffffff',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              }}
              title={`${book.chunk_count || 0} chunks indexed in Qdrant Cloud`}
            >
              ✓ Ready
            </span>
          ) : ingesting || book.ingest_status === 'processing' ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 8px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(59, 130, 246, 0.9)',
                color: '#ffffff',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              }}
            >
              <span className="spinner-mini" style={{ width: 10, height: 10, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
              Indexing…
            </span>
          ) : book.ingest_status === 'failed' ? (
            <span
              style={{
                padding: '4px 8px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(239, 68, 68, 0.9)',
                color: '#ffffff',
                backdropFilter: 'blur(8px)',
              }}
            >
              Failed
            </span>
          ) : (
            <button
              onClick={handleIngestClick}
              style={{
                cursor: 'pointer',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(245, 158, 11, 0.9)',
                color: '#ffffff',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              }}
              title="Click to index book into Qdrant for AI Chat"
            >
              + Ingest
            </button>
          )}
        </div>

        {/* Hover overlay */}
        <div className="book-card-read-overlay">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '80%', alignItems: 'center' }}>
            <Link
              to={`/chat/${encodeURIComponent(book.id)}`}
              className="btn btn-primary"
              style={{ width: '100%', textAlign: 'center', padding: '8px 12px', fontSize: 13 }}
              onClick={(e) => e.stopPropagation()}
            >
              💬 AI Chat
            </Link>
            <Link
              to={`/read/${encodeURIComponent(book.id)}`}
              className="btn btn-secondary"
              style={{ width: '100%', textAlign: 'center', padding: '8px 12px', fontSize: 13 }}
              onClick={(e) => e.stopPropagation()}
            >
              📖 Read PDF
            </Link>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="book-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <h3 className="book-card-title">{book.title}</h3>
          <p className="book-card-author">{book.author}</p>
        </div>

        <div>
          <div className="book-card-meta" style={{ marginBottom: 10 }}>
            {book.page_count && (
              <span className="book-card-pages">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                {book.page_count} pages
              </span>
            )}
            <span>{formatFileSize(book.size_bytes)}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Link
              to={`/chat/${encodeURIComponent(book.id)}`}
              className="btn btn-secondary"
              style={{
                fontSize: 12,
                padding: '6px 8px',
                textAlign: 'center',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
              id={`chat-btn-${book.id}`}
            >
              <span>💬</span> Chat
            </Link>
            <Link
              to={`/read/${encodeURIComponent(book.id)}`}
              className="btn btn-ghost"
              style={{
                fontSize: 12,
                padding: '6px 8px',
                textAlign: 'center',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
              id={`read-btn-${book.id}`}
            >
              <span>📖</span> Read
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
