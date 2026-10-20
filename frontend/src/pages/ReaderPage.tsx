import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { fetchBook } from '../api/books'
import { getPdfUrl } from '../api/books'
import { BookDetail } from '../types'
import { useTheme } from '../context/ThemeContext'

// Configure PDF.js worker — versions are aligned at 4.8.69
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

const MIN_ZOOM = 0.4
const MAX_ZOOM = 3.0
const ZOOM_STEP = 0.2

// Icons
const ChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
)
const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
)
const ZoomIn = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/>
  </svg>
)
const ZoomOut = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M8 11h6"/>
  </svg>
)
const FitWidth = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 3H3M21 21H3M3 12h18M9 7l-3 5 3 5M15 7l3 5-3 5"/>
  </svg>
)
const ArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
  </svg>
)

export default function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const { resolvedTheme } = useTheme()

  // Book metadata
  const [book, setBook] = useState<BookDetail | null>(null)
  const [bookError, setBookError] = useState('')

  // PDF state
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState('1')
  const [zoom, setZoom] = useState(1.0)
  const [pdfError, setPdfError] = useState('')
  const [pdfLoading, setPdfLoading] = useState(true)

  // Fit-to-viewport width scale
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined)

  const safeBookId = bookId ? decodeURIComponent(bookId) : ''

  // Fetch book metadata
  useEffect(() => {
    if (!safeBookId) { setBookError('No book ID provided.'); return }
    fetchBook(safeBookId)
      .then(setBook)
      .catch((err) => setBookError(err instanceof Error ? err.message : 'Book not found'))
  }, [safeBookId])

  // Measure viewport for fit-to-width
  useEffect(() => {
    const measure = () => {
      // Viewport width minus padding
      setContainerWidth(Math.min(window.innerWidth - 64, 900))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const pdfUrl = safeBookId ? getPdfUrl(safeBookId) : null

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setPdfLoading(false)
    setPdfError('')
  }, [])

  const onDocumentLoadError = useCallback((error: Error) => {
    setPdfError(error.message || 'Failed to load PDF.')
    setPdfLoading(false)
  }, [])

  // Page navigation
  const goToPage = (p: number) => {
    const clamped = Math.max(1, Math.min(p, numPages))
    setCurrentPage(clamped)
    setPageInputValue(String(clamped))
  }

  const prevPage = () => goToPage(currentPage - 1)
  const nextPage = () => goToPage(currentPage + 1)

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value)
  }

  const commitPageInput = () => {
    const n = parseInt(pageInputValue, 10)
    if (!isNaN(n)) goToPage(n)
    else setPageInputValue(String(currentPage))
  }

  const handlePageInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitPageInput()
    if (e.key === 'Escape') setPageInputValue(String(currentPage))
  }

  // Zoom
  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))
  const resetZoom = () => setZoom(1.0)

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prevPage() }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); nextPage() }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn() }
      if (e.key === '-') { e.preventDefault(); zoomOut() }
      if (e.key === '0') { e.preventDefault(); resetZoom() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const pageWidth = containerWidth ? containerWidth * zoom : undefined

  if (bookError) {
    return (
      <div className="reader-page">
        <div className="reader-toolbar">
          <div className="reader-toolbar-left">
            <Link to="/library" className="btn btn-ghost" id="reader-back-btn">
              <ArrowLeft /> Back to Library
            </Link>
          </div>
        </div>
        <div className="state-container" role="alert">
          <div className="state-icon">⚠️</div>
          <h1 className="state-title">Book Not Found</h1>
          <p className="state-subtitle">{bookError}</p>
          <Link to="/library" className="btn btn-secondary" style={{ marginTop: 24 }}>
            Return to Library
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="reader-page">
      {/* ── Toolbar ── */}
      <header className="reader-toolbar" role="toolbar" aria-label="PDF reader controls">
        {/* Left: back + title */}
        <div className="reader-toolbar-left">
          <button
            className="btn btn-ghost"
            onClick={() => navigate('/library')}
            aria-label="Back to Library"
            id="reader-back-btn"
          >
            <ArrowLeft />
            <span style={{ marginLeft: 4 }}>Library</span>
          </button>
          {book && (
            <span className="reader-book-title" title={book.title}>
              {book.title}
            </span>
          )}
        </div>

        {/* Center: page controls */}
        <div className="reader-toolbar-center">
          <button
            className="btn btn-icon"
            onClick={prevPage}
            disabled={currentPage <= 1 || !numPages}
            aria-label="Previous page"
            id="reader-prev-btn"
          >
            <ChevronLeft />
          </button>

          <input
            type="text"
            inputMode="numeric"
            className="reader-page-input"
            value={pageInputValue}
            onChange={handlePageInputChange}
            onBlur={commitPageInput}
            onKeyDown={handlePageInputKey}
            aria-label="Current page number"
            id="reader-page-input"
            disabled={!numPages}
          />

          <span className="reader-page-sep" aria-label={`of ${numPages} pages`}>
            / {numPages || '—'}
          </span>

          <button
            className="btn btn-icon"
            onClick={nextPage}
            disabled={currentPage >= numPages || !numPages}
            aria-label="Next page"
            id="reader-next-btn"
          >
            <ChevronRight />
          </button>
        </div>

        {/* Right: zoom controls + theme */}
        <div className="reader-toolbar-right">
          <button
            className="btn btn-icon"
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            id="reader-zoom-out-btn"
          >
            <ZoomOut />
          </button>

          <button
            className="reader-zoom-display btn btn-ghost"
            onClick={resetZoom}
            aria-label="Reset zoom to 100%"
            id="reader-zoom-reset-btn"
            style={{ minWidth: 52, fontVariantNumeric: 'tabular-nums' }}
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            className="btn btn-icon"
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            id="reader-zoom-in-btn"
          >
            <ZoomIn />
          </button>

          <button
            className="btn btn-icon"
            onClick={resetZoom}
            aria-label="Fit to width"
            title="Fit to width (resets zoom)"
            id="reader-fit-btn"
          >
            <FitWidth />
          </button>
        </div>
      </header>

      {/* ── PDF Viewport ── */}
      <main className="reader-viewport" aria-label="PDF document viewer">
        {!pdfUrl && (
          <div className="state-container">
            <div className="spinner" />
            <p className="state-subtitle">Preparing document…</p>
          </div>
        )}

        {pdfUrl && (
          <div className="reader-document-container">
            {/* Loading indicator while PDF loads */}
            {pdfLoading && !pdfError && (
              <div className="state-container">
                <div className="spinner" />
                <p className="state-subtitle">Loading PDF…</p>
              </div>
            )}

            {pdfError && (
              <div className="state-container" role="alert">
                <div className="state-icon">📄</div>
                <h2 className="state-title">Could not load PDF</h2>
                <p className="state-subtitle">{pdfError}</p>
                <Link to="/library" className="btn btn-secondary" style={{ marginTop: 24 }}>
                  Back to Library
                </Link>
              </div>
            )}

            {!pdfError && (
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={null}
                error={null}
              >
                <div
                  className="reader-page-wrapper"
                  style={{ display: pdfLoading ? 'none' : 'block' }}
                >
                  <Page
                    pageNumber={currentPage}
                    width={pageWidth}
                    renderAnnotationLayer
                    renderTextLayer
                    loading={
                      <div style={{ 
                        width: pageWidth || 700, 
                        height: 900, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        background: '#fff',
                        color: '#999',
                        fontSize: 14,
                      }}>
                        Loading page…
                      </div>
                    }
                    error={
                      <div style={{ padding: 32, color: 'var(--text-secondary)' }}>
                        Could not render this page.
                      </div>
                    }
                  />
                </div>
              </Document>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
