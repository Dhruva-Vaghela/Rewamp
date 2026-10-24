import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookSummary } from '../types'
import { getCoverUrl, triggerBookIngest } from '../api/books'

// A palette of rich antique cover gradients and ornaments for fallback covers
const COVER_PALETTES = [
  { bg: 'linear-gradient(160deg, #181028 0%, #291244 100%)', textColor: '#ebd5ff', spineColor: '#3d1c68', ornament: '✦' },
  { bg: 'linear-gradient(160deg, #0c1a14 0%, #17382a 100%)', textColor: '#c8e8d8', spineColor: '#1a4e38', ornament: '❧' },
  { bg: 'linear-gradient(160deg, #241108 0%, #3e1b0c 100%)', textColor: '#f2dac4', spineColor: '#582410', ornament: '☙' },
  { bg: 'linear-gradient(160deg, #0e1424 0%, #182848 100%)', textColor: '#c8d8f8', spineColor: '#162e58', ornament: '✧' },
  { bg: 'linear-gradient(160deg, #241908 0%, #402c0c 100%)', textColor: '#f8e8c0', spineColor: '#5c3e0a', ornament: '✾' },
  { bg: 'linear-gradient(160deg, #0a181c 0%, #15323a 100%)', textColor: '#b8e8e8', spineColor: '#16444e', ornament: '❊' },
  { bg: 'linear-gradient(160deg, #221020 0%, #3a1836 100%)', textColor: '#e8c8e8', spineColor: '#521c4c', ornament: '✦' },
  { bg: 'linear-gradient(160deg, #141c0e 0%, #263816 100%)', textColor: '#d4e8c0', spineColor: '#284e14', ornament: '❧' },
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

  const handleCardClick = () => {
    navigate(isReady ? `/chat/${encodeURIComponent(book.id)}` : `/read/${encodeURIComponent(book.id)}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }

  return (
    <article
      className="fantasy-book-card"
      id={`book-card-${book.id}`}
      tabIndex={0}
      role="article"
      aria-label={`${book.title} by ${book.author}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      {/* 3D Physical Book Visual */}
      <div className="physical-book-stage">
        <div className="physical-book-object">
          {/* Subtle Ambient Backlight Glow on hover */}
          <div className="book-stage-glow" aria-hidden="true" />

          {/* Hardcover Outer Frame */}
          <div className="physical-cover-frame">
            {/* Authentic Left Leather Spine Ridge */}
            <div className="spine-ridge-overlay" aria-hidden="true">
              <span className="spine-crease-line" />
            </div>

            {/* Stacked Paper Deckled Edge (Right & Bottom) */}
            <div className="page-stack-rim" aria-hidden="true" />

            {/* Cover Image or Fallback */}
            {!coverError ? (
              <div className="book-cover-media">
                {!coverLoaded && (
                  <div className="book-cover-skeleton" aria-hidden="true">
                    <div className="skeleton-shimmer" />
                  </div>
                )}
                <img
                  src={coverUrl}
                  alt={`Cover of ${book.title}`}
                  loading="lazy"
                  decoding="async"
                  className={`book-cover-img ${coverLoaded ? 'is-loaded' : ''}`}
                  onLoad={() => setCoverLoaded(true)}
                  onError={() => {
                    console.warn(`Cover failed to load for book '${book.id}', falling back to decorative cover.`)
                    setCoverError(true)
                  }}
                />
              </div>
            ) : (
              <div
                className="book-fallback-cover"
                style={{ background: palette.bg, color: palette.textColor }}
              >
                <div className="fallback-spine-band" style={{ background: palette.spineColor }} />
                <div className="fallback-inner-border" style={{ borderColor: `${palette.textColor}30` }} />
                <div className="fallback-ornament" style={{ color: palette.textColor }}>
                  {palette.ornament}
                </div>
                <div className="fallback-title" style={{ color: palette.textColor }}>
                  {book.title}
                </div>
                <div className="fallback-author" style={{ color: palette.textColor }}>
                  {book.author}
                </div>
              </div>
            )}

            {/* Soft Satin Cover Finish */}
            <div className="cover-satin-finish" aria-hidden="true" />

            {/* Ingestion Status Jewel Badge */}
            <div className="book-status-jewel">
              {isReady ? (
                <span className="badge-ready" title={`${book.chunk_count || 0} chunks indexed in Qdrant Cloud`}>
                  <span className="badge-dot" />
                  <span>Ready</span>
                </span>
              ) : ingesting || book.ingest_status === 'processing' ? (
                <span className="badge-indexing">
                  <span className="spinner-mini" />
                  <span>Indexing…</span>
                </span>
              ) : book.ingest_status === 'failed' ? (
                <span className="badge-failed">Failed</span>
              ) : (
                <button
                  onClick={handleIngestClick}
                  className="badge-ingest-action"
                  title="Click to index book into Qdrant for AI Chat"
                  aria-label={`Index ${book.title} for AI`}
                >
                  <span>⚡ Index</span>
                </button>
              )}
            </div>

            {/* Quick Action Overlay (Reveals on Hover / Focus) */}
            <div className="book-hover-actions-overlay" aria-hidden="true">
              <div className="hover-actions-inner">
                <Link
                  to={`/chat/${encodeURIComponent(book.id)}`}
                  className="hover-action-btn hover-btn-chat"
                  onClick={(e) => e.stopPropagation()}
                  tabIndex={-1}
                >
                  <span>💬 AI Chat</span>
                </Link>
                <Link
                  to={`/read/${encodeURIComponent(book.id)}`}
                  className="hover-action-btn hover-btn-read"
                  onClick={(e) => e.stopPropagation()}
                  tabIndex={-1}
                >
                  <span>📖 Read Book</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Book Metadata & Title Bar */}
      <div className="book-card-info-panel">
        <h3 className="fantasy-card-title" title={book.title}>
          {book.title}
        </h3>
        <p className="fantasy-card-author">{book.author}</p>

        <div className="fantasy-card-details">
          {book.page_count ? (
            <span className="detail-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <span>{book.page_count} pages</span>
            </span>
          ) : null}
          <span className="detail-pill detail-filesize">{formatFileSize(book.size_bytes)}</span>
        </div>

        {/* Permanent Quick-Action Links (Accessible on Mobile / Touch) */}
        <div className="card-footer-actions">
          <Link
            to={`/chat/${encodeURIComponent(book.id)}`}
            className="footer-btn footer-btn-chat"
            id={`chat-btn-${book.id}`}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Open AI Chat for ${book.title}`}
          >
            <span aria-hidden="true">💬</span> Chat
          </Link>
          <Link
            to={`/read/${encodeURIComponent(book.id)}`}
            className="footer-btn footer-btn-read"
            id={`read-btn-${book.id}`}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Read PDF for ${book.title}`}
          >
            <span aria-hidden="true">📖</span> Read
          </Link>
        </div>
      </div>
    </article>
  )
}
