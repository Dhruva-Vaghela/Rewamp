import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookSummary } from '../types'
import { getCoverUrl } from '../api/books'

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
}

export default function BookCard({ book }: BookCardProps) {
  const [coverLoaded, setCoverLoaded] = useState(false)
  const [coverError, setCoverError] = useState(false)
  const palette = getPalette(book.title)
  const coverUrl = book.cover_url || getCoverUrl(book.id)

  return (
    <Link
      to={`/read/${encodeURIComponent(book.id)}`}
      className="book-card"
      aria-label={`Read ${book.title} by ${book.author}`}
      id={`book-card-${book.id}`}
    >
      {/* Cover container */}
      <div className="book-card-cover">
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
              {/* Spine decoration */}
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
              {/* Ornamental lines */}
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

        {/* Hover overlay */}
        <div className="book-card-read-overlay">
          <span className="book-card-read-btn">Open Book</span>
        </div>
      </div>

      {/* Info */}
      <div className="book-card-body">
        <h3 className="book-card-title">{book.title}</h3>
        <p className="book-card-author">{book.author}</p>
        <div className="book-card-meta">
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
      </div>
    </Link>
  )
}

