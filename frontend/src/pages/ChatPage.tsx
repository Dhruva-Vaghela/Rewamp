import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Nav from '../components/Nav'
import CentralKnowledgePortal from '../components/CentralKnowledgePortal'
import ChatMagicalBackground from '../components/ChatMagicalBackground'
import {
  fetchBooks,
  fetchBook,
  getCoverUrl,
  sendChatMessage,
  triggerBookIngest,
  fetchBookIngestStatus,
} from '../api/books'
import { BookSummary, BookDetail, ChatMessage, Citation } from '../types'

// ── Icons ──
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m22 2-7 20-4-9-9-4Z"/>
    <path d="M22 2 11 13"/>
  </svg>
)

const SparklesIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
  </svg>
)

const BookOpenIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
)

const RefreshCwIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/>
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
    <path d="M8 16H3v5"/>
  </svg>
)

const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
)

// ── Thematic Card Icons matching the Reference Design ──
const RabbitIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 2c-1.5 2-1 6-1 8" />
    <path d="M8 3c-.8 2-.5 4.5 0 6" />
    <path d="M14 2c1.5 2 1 6 1 8" />
    <path d="M16 3c.8 2 .5 4.5 0 6" />
    <path d="M8 10a4 4 0 0 0-4 4c0 3 3 5 8 5s8-2 8-5a4 4 0 0 0-4-4" />
    <circle cx="9.5" cy="13.5" r="0.75" fill="currentColor" />
    <circle cx="14.5" cy="13.5" r="0.75" fill="currentColor" />
    <path d="M11 16.5c.5.5 1.5.5 2 0" />
    <path d="M6 18c-1 1.5-1 3.5 1 4 2.5.5 10 .5 10 0 2-.5 2-2.5 1-4" />
  </svg>
)

const TopHatIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <ellipse cx="12" cy="19" rx="9.5" ry="2.5" />
    <path d="M6.5 18V8a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v10" />
    <path d="M6.5 15h11" />
    <path d="M6.5 8c0-1.2 2.5-2 5.5-2s5.5.8 5.5 2" />
  </svg>
)

const CatIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5c-3 0-5 1.5-6 3.5L4 4l1.5 5.5C4.5 11 4 12.5 4 14.5 4 18.5 7.5 21 12 21s8-2.5 8-6.5c0-2-.5-3.5-1.5-5L20 4l-2 4.5C17 6.5 15 5 12 5Z" />
    <circle cx="9" cy="13" r="0.9" fill="currentColor" />
    <circle cx="15" cy="13" r="0.9" fill="currentColor" />
    <polygon points="12,15 11,16.5 13,16.5" fill="currentColor" />
    <path d="M6.5 14H3.5" />
    <path d="M6.5 16.5H4" />
    <path d="M17.5 14H20.5" />
    <path d="M17.5 16.5H20" />
  </svg>
)

const TeaCupIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 19h14" />
    <path d="M4 10v4a5 5 0 0 0 5 5h2a5 5 0 0 0 5-5v-4H4Z" />
    <path d="M16 11h2a2.5 2.5 0 0 1 0 5h-2" />
    <path d="M7 6c0-1.5 1.5-2 1.5-3" />
    <path d="M11 6c0-1.5 1.5-2 1.5-3" />
  </svg>
)

const MagnifyingGlassIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

const QuillIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 2c-3.5 0-7 2-9.5 5.5A17 17 0 0 0 6 18l-3 4 4-2.5c4-2 7.5-5 9.5-9.5C18 7.5 20 4.5 20 2Z" />
    <path d="M14 8l-6 6" />
  </svg>
)

const CompassIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fillOpacity="0.25" />
  </svg>
)

const SparkleStarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 2 2.6 6.8L21.4 11l-5.6 4.8 1.8 7.2-5.6-3.8-5.6 3.8 1.8-7.2L2.6 11l6.8-2.2L12 2Z"/>
  </svg>
)

// Helper to assign thematic icons for questions
function getQuestionThematicIcon(question: string, index: number) {
  const q = question.toLowerCase()
  if (q.includes('rabbit') || q.includes('hole')) return <RabbitIcon />
  if (q.includes('caterpillar') || q.includes('advice') || (q.includes('hatter') && !q.includes('tea'))) return <TopHatIcon />
  if (q.includes('cheshire') || q.includes('cat')) return <CatIcon />
  if (q.includes('tea') || q.includes('cup') || q.includes('riddle') || q.includes('party')) return <TeaCupIcon />
  if (q.includes('sherlock') || q.includes('holmes') || q.includes('deduce') || q.includes('mystery')) return <MagnifyingGlassIcon />
  if (q.includes('frankenstein') || q.includes('creature') || q.includes('arctic')) return <CompassIcon />
  if (q.includes('gatsby') || q.includes('light') || q.includes('dock')) return <SparkleStarIcon />
  if (q.includes('darcy') || q.includes('elizabeth') || q.includes('bennet')) return <QuillIcon />

  const fallbacks = [<RabbitIcon />, <TopHatIcon />, <CatIcon />, <TeaCupIcon />]
  return fallbacks[index % fallbacks.length]
}

// Clean and format text into natural, conversational plain text without markdown asterisks or [Source X] tags
function formatCleanProse(text: string): string {
  if (!text) return ''
  return text
    .replace(/\[Source\s+\d+\]/gi, '')
    .replace(/\(Source\s+\d+\)/gi, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^(Based on the (provided|retrieved) (excerpts?|text|passages?),?\s*|According to the (provided|retrieved) (excerpts?|text|passages?),?\s*|From the (provided|retrieved) (excerpts?|text|passages?),?\s*)/i, '')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

// Book-specific suggested questions
const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  'alice-s-adventures-in-wonderland-lewis-carroll-9898': [
    'Why did Alice follow the White Rabbit down the rabbit hole?',
    'What advice did the Caterpillar give Alice?',
    'Who is the Cheshire Cat and why can it disappear?',
    'What riddle does the Mad Hatter ask at the tea-party?',
  ],
  'frankenstein-mary-shelley': [
    'What drove Victor Frankenstein to create the creature?',
    'How does the creature describe his first experiences in nature?',
    'What request does the creature make of Victor in the mountains?',
    'Where does the final confrontation in the arctic take place?',
  ],
  'the-great-gatsby-f-scott-fitzgerald': [
    'What does the green light at the end of the dock represent?',
    'How does Nick Carraway describe his relationship with Gatsby?',
    'Why does Gatsby throw such elaborate parties?',
    'What happened on the day of the confrontation in New York?',
  ],
  'pride-and-prejudice-jane-austen': [
    'What is Elizabeth Bennet’s first impression of Mr. Darcy?',
    'Why does Mr. Collins propose to Elizabeth Bennet?',
    'What causes Elizabeth to reconsider her opinion of Darcy?',
    'How does Lady Catherine de Bourgh try to intervene?',
  ],
  'the-adventures-of-sherlock-holmes-arthur-conan-doyle-9924': [
    'How does Sherlock Holmes describe Irene Adler in A Scandal in Bohemia?',
    'What is the mystery behind the Red-Headed League?',
    'How does Holmes deduce Dr. Watson’s activities when they meet?',
    'What was the secret of the Speckled Band?',
  ],
  'phantastes-a-faerie-romance-for-men-and-women-george-macdonald': [
    'How does Anodos discover the doorway into the Fairy Land?',
    'What warning is Anodos given about the Ash Tree and Alder Maiden?',
    'Who is the marble lady that Anodos seeks to awaken?',
    'What does the shadow that follows Anodos represent?',
  ],
  'the-mill-on-the-floss-george-eliot': [
    'What defines the relationship between Maggie Tulliver and her brother Tom?',
    'Why does Mr. Tulliver lose the mill in the lawsuit against Wakem?',
    'How does Maggie’s relationship with Philip Wakem develop in secret?',
    'What tragedy occurs during the great flood on the Floss?',
  ],
  'the-three-musketeers-alexandre-dumas': [
    'How does d’Artagnan meet and challenge Athos, Porthos, and Aramis?',
    'What mission do the musketeers undertake to retrieve the diamond studs?',
    'Who is Milady de Winter and what is her past with Athos?',
    'What was the significance of Cardinal Richelieu’s safe-conduct letter?',
  ],
}

const GENERIC_QUESTIONS = [
  'What are the primary themes and motifs explored in this book?',
  'Summarize the opening chapter and the initial conflict.',
  'Who are the main characters introduced early in the story?',
  'What major turning point or crisis occurs in the narrative?',
]

const CHAT_STORAGE_PREFIX = 'rewamp_chat_'
const LAST_ACTIVE_BOOK_KEY = 'rewamp_last_active_book_id'

function loadSavedMessages(bookId: string): ChatMessage[] {
  if (!bookId) return []
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return []
    const raw = window.sessionStorage.getItem(`${CHAT_STORAGE_PREFIX}${bookId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
    }
    return []
  } catch (err) {
    console.warn(`Failed to parse saved chat messages for ${bookId}:`, err)
    return []
  }
}

function saveMessages(bookId: string, messages: ChatMessage[]): void {
  if (!bookId) return
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return
    if (messages.length === 0) {
      window.sessionStorage.removeItem(`${CHAT_STORAGE_PREFIX}${bookId}`)
    } else {
      window.sessionStorage.setItem(`${CHAT_STORAGE_PREFIX}${bookId}`, JSON.stringify(messages))
    }
  } catch (err) {
    console.warn(`Failed to persist chat messages for ${bookId}:`, err)
  }
}

function clearSavedMessages(bookId: string): void {
  if (!bookId) return
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return
    window.sessionStorage.removeItem(`${CHAT_STORAGE_PREFIX}${bookId}`)
  } catch (err) {
    console.warn(`Failed to remove saved chat messages for ${bookId}:`, err)
  }
}

function saveLastActiveBookId(bookId: string): void {
  if (!bookId) return
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return
    window.sessionStorage.setItem(LAST_ACTIVE_BOOK_KEY, bookId)
  } catch {
    // Ignore quota or security errors
  }
}

function getLastActiveBookId(): string | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null
    return window.sessionStorage.getItem(LAST_ACTIVE_BOOK_KEY)
  } catch {
    return null
  }
}

export default function ChatPage() {
  const { bookId } = useParams<{ bookId?: string }>()
  const navigate = useNavigate()

  const [allBooks, setAllBooks] = useState<BookSummary[]>([])
  const [selectedBook, setSelectedBook] = useState<BookDetail | null>(null)
  const [loadingBook, setLoadingBook] = useState(true)
  const [ingestStatus, setIngestStatus] = useState<string>('pending')
  const [isIngesting, setIsIngesting] = useState(false)

  // Chat state - restored from sessionStorage for active book if available
  const [messages, setMessages] = useState<ChatMessage[]>(() => (bookId ? loadSavedMessages(bookId) : []))
  const [prevBookId, setPrevBookId] = useState(bookId)
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [topK] = useState(5)

  // Inspection & diagnostic state
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null)

  // Avoid stale-state issues: ensure displayed messages match active bookId immediately
  if (bookId !== prevBookId) {
    setPrevBookId(bookId)
    setMessages(bookId ? loadSavedMessages(bookId) : [])
    setInput('')
    setActiveCitation(null)
    setIsSending(false)
  }

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isSending])

  // Persist messages to sessionStorage whenever they update for the active book
  useEffect(() => {
    if (bookId && bookId === prevBookId) {
      saveMessages(bookId, messages)
    }
  }, [bookId, messages, prevBookId])

  // Track the last active book in sessionStorage
  useEffect(() => {
    if (bookId) {
      saveLastActiveBookId(bookId)
    }
  }, [bookId])

  // Load all books for catalog dropdown / selection
  useEffect(() => {
    fetchBooks()
      .then((data) => {
        setAllBooks(data)
        // If no bookId in URL, redirect to last active book if valid, or default to first ready book
        if (!bookId && data.length > 0) {
          let targetBook: BookSummary | undefined
          const lastActiveId = getLastActiveBookId()
          if (lastActiveId) {
            targetBook = data.find((b) => b.id === lastActiveId)
          }
          if (!targetBook) {
            targetBook = data.find((b) => b.ingest_status === 'ready') || data[0]
          }
          if (targetBook) {
            navigate(`/chat/${encodeURIComponent(targetBook.id)}`, { replace: true })
          }
        }
      })
      .catch(console.error)
  }, [bookId, navigate])

  // Load selected book details on bookId change (does NOT reset chat messages)
  useEffect(() => {
    if (!bookId) return

    // Instantly preview book from allBooks if loaded to eliminate delay/flash
    if (allBooks.length > 0) {
      const match = allBooks.find((b) => b.id === bookId)
      if (match) {
        setSelectedBook(match as unknown as BookDetail)
        setIngestStatus(match.ingest_status || 'pending')
      }
    }

    setLoadingBook(true)
    fetchBook(bookId)
      .then((b) => {
        setSelectedBook(b)
        setIngestStatus(b.ingest_status || 'pending')
        setLoadingBook(false)
      })
      .catch((err) => {
        console.error('Failed to load book:', err)
        setLoadingBook(false)
      })

    fetchBookIngestStatus(bookId)
      .then((st) => {
        setIngestStatus(st.status)
      })
      .catch(console.error)
  }, [bookId, allBooks])

  // Periodic poll if current book is processing
  useEffect(() => {
    if (ingestStatus !== 'processing' && !isIngesting) return

    const interval = setInterval(() => {
      if (!bookId) return
      fetchBookIngestStatus(bookId)
        .then((st) => {
          setIngestStatus(st.status)
          if (st.status === 'ready') {
            setIsIngesting(false)
            if (selectedBook) {
              setSelectedBook({ ...selectedBook, ingest_status: 'ready', chunk_count: st.chunk_count })
            }
          }
        })
        .catch(console.error)
    }, 3000)

    return () => clearInterval(interval)
  }, [bookId, ingestStatus, isIngesting, selectedBook])

  const handleStartIngest = async () => {
    if (!bookId || isIngesting) return
    setIsIngesting(true)
    setIngestStatus('processing')
    try {
      await triggerBookIngest(bookId)
    } catch (err) {
      console.error('Failed to trigger ingestion:', err)
      setIsIngesting(false)
    }
  }

  const handleSendMessage = async (textToSend?: string) => {
    const q = (textToSend || input).trim()
    if (!q || isSending || !bookId) return

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsSending(true)

    try {
      const response = await sendChatMessage(bookId, q, topK)

      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        sender: 'assistant',
        text: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: response.citations,
        is_grounded: response.is_grounded,
        sufficient_evidence: response.sufficient_evidence,
        diagnostics: response.diagnostics,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred while querying the book.'
      const errorMessage: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: `Error: ${errorMsg}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: errorMsg,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleResetChat = () => {
    setMessages([])
    setActiveCitation(null)
    if (bookId) {
      clearSavedMessages(bookId)
    }
  }

  const currentQuestions = useMemo(() => {
    if (!bookId) return GENERIC_QUESTIONS
    return SUGGESTED_QUESTIONS[bookId] || GENERIC_QUESTIONS
  }, [bookId])

  const isBookReady = ingestStatus === 'ready'

  return (
    <div className="chat-page">
      {/* Cinematic Enchanted Library Magical Backdrop */}
      <ChatMagicalBackground />

      <Nav />

      {/* Main Workspace Layout */}
      <div className="chat-workspace-layout">
        
        {/* Book Header Bar */}
        <header className="chat-book-header-bar">
          {/* Left: Book Thumbnail & Info */}
          <div className="chat-header-left">
            {selectedBook && (
              <img
                src={selectedBook.cover_url || getCoverUrl(selectedBook.id)}
                alt={selectedBook.title}
                className="chat-book-thumb"
              />
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 className="chat-book-title">
                  {selectedBook ? selectedBook.title : 'AI Reading Workspace'}
                </h1>

                {/* Status Badge */}
                {isBookReady ? (
                  <span className="chat-status-jewel-pill ready">
                    ✓ Ready ({selectedBook?.chunk_count || 0} chunks)
                  </span>
                ) : ingestStatus === 'processing' || isIngesting ? (
                  <span className="chat-status-jewel-pill processing">
                    <span className="spinner-mini" style={{ width: 8, height: 8, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    Indexing Book…
                  </span>
                ) : (
                  <span className="chat-status-jewel-pill pending">
                    Needs Indexing
                  </span>
                )}
              </div>
              <p className="chat-book-author">
                {selectedBook ? `by ${selectedBook.author}` : 'Select a book to ask grounded questions'}
              </p>
            </div>
          </div>

          {/* Right: Actions & Book Switcher */}
          <div className="chat-header-actions">
            {/* Book Selector Dropdown */}
            {allBooks.length > 0 && (
              <select
                aria-label="Select book to chat with"
                value={bookId || ''}
                onChange={(e) => {
                  const nextId = e.target.value
                  if (nextId && nextId !== bookId) {
                    setInput('')
                    setActiveCitation(null)
                    setIsSending(false)
                    const found = allBooks.find((b) => b.id === nextId)
                    if (found) {
                      setSelectedBook(found as unknown as BookDetail)
                      setIngestStatus(found.ingest_status || 'pending')
                    }
                    navigate(`/chat/${encodeURIComponent(nextId)}`)
                  }
                }}
                className="chat-book-selector"
              >
                {allBooks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} {b.ingest_status === 'ready' ? '✓' : ''}
                  </option>
                ))}
              </select>
            )}

            {/* Read PDF Button */}
            {bookId && (
              <Link
                to={`/read/${encodeURIComponent(bookId)}`}
                className="chat-read-pdf-btn"
                title="Open PDF Reader"
              >
                <BookOpenIcon />
                <span>Read PDF</span>
              </Link>
            )}

            {/* Reset Chat */}
            {messages.length > 0 && (
              <button
                className="chat-new-chat-btn"
                onClick={handleResetChat}
                title="Clear current conversation"
              >
                <RefreshCwIcon />
                <span>New Chat</span>
              </button>
            )}
          </div>
        </header>

        {/* Uningested Warning Banner */}
        {!isBookReady && !loadingBook && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
              padding: '14px 20px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              marginBottom: 16,
              backdropFilter: 'blur(8px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>💡</span>
              <div>
                <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>
                  This book has not been indexed for AI retrieval yet.
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  Extracting text and storing vectors in Qdrant enables instant, grounded answers with citations.
                </p>
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleStartIngest}
              disabled={isIngesting || ingestStatus === 'processing'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 16px' }}
            >
              {isIngesting || ingestStatus === 'processing' ? (
                <>
                  <span className="spinner-mini" style={{ width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                  <span>Indexing Now…</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Index Book Now</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Message Conversation Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            minHeight: 400,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            padding: '12px 0 24px',
            position: 'relative',
            zIndex: 2,
          }}
        >
          {messages.length === 0 ? (
            /* Welcome Empty State: Living Knowledge Portal + 2-Column Suggested Grid */
            <div className="chat-welcome-container">
              {/* Central Living Knowledge Portal with dynamic glow */}
              <CentralKnowledgePortal isGenerating={isSending} />

              <h2 className="chat-welcome-title">Step Inside the Story</h2>
              <p className="chat-welcome-subtitle">
                Ask questions, uncover hidden details, and explore the world within your book.
              </p>

              {/* Eyebrow Label */}
              <div className="chat-suggested-eyebrow">
                <span>✦ SUGGESTED QUESTIONS ✦</span>
              </div>

              {/* 2-Column Desktop / Responsive Mobile Suggested Question Cards */}
              <div className="chat-suggested-grid">
                {currentQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    className="chat-suggested-card"
                    onClick={() => handleSendMessage(q)}
                    disabled={isSending || !isBookReady}
                    title={q}
                  >
                    <div className="suggested-card-icon">
                      {getQuestionThematicIcon(q, idx)}
                    </div>
                    <span className="suggested-card-text">{q}</span>
                    <div className="suggested-card-arrow" aria-hidden="true">
                      <ArrowRightIcon />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Render Message List */
            messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '100%',
                }}
              >
                {/* Message Bubble Container */}
                <div
                  style={{
                    maxWidth: msg.sender === 'user' ? '75%' : '88%',
                    padding: msg.sender === 'user' ? '12px 18px' : '18px 22px',
                    borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: msg.sender === 'user' ? 'var(--gradient-cta)' : 'var(--chat-card-glass)',
                    color: msg.sender === 'user' ? '#0d0b08' : 'var(--text-primary)',
                    border: msg.sender === 'user' ? 'none' : '1px solid var(--chat-card-border)',
                    boxShadow: 'var(--shadow-card)',
                    fontSize: 14.5,
                    lineHeight: 1.65,
                    fontFamily: msg.sender === 'assistant' ? 'var(--font-reading)' : 'var(--font-body)',
                    backdropFilter: msg.sender === 'assistant' ? 'blur(10px)' : 'none',
                    WebkitBackdropFilter: msg.sender === 'assistant' ? 'blur(10px)' : 'none',
                  }}
                >
                  {/* Sender Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      color: msg.sender === 'user' ? 'rgba(0,0,0,0.65)' : 'var(--accent-gold)',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <span>{msg.sender === 'user' ? 'You' : 'Rewamp Scholarly Assistant'}</span>
                    <span style={{ fontWeight: 400, opacity: 0.8 }}>{msg.timestamp}</span>
                  </div>

                  {/* Insufficient Evidence Notice */}
                  {msg.sender === 'assistant' && msg.sufficient_evidence === false && (
                    <div
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderLeft: '3px solid #ef4444',
                        borderRadius: 4,
                        marginBottom: 10,
                        fontSize: 12,
                        color: 'var(--text-primary)',
                      }}
                    >
                      ⚠️ <strong>Insufficient Evidence in Book:</strong> The text excerpts retrieved for this book do not contain conclusive information to answer this query.
                    </div>
                  )}

                  {/* Text Content */}
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 15, lineHeight: 1.7 }}>
                    {formatCleanProse(msg.text)}
                  </div>

                  {/* Citations List */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div
                      style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          color: 'var(--text-muted)',
                          marginBottom: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <span>Verified Citations ({msg.citations.length}):</span>
                        <span style={{ fontSize: 10, fontWeight: 400 }}>(click to view passage & jump to page)</span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {msg.citations.map((cite) => (
                          <button
                            key={cite.source_id}
                            onClick={() => setActiveCitation(cite)}
                            style={{
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 10px',
                              borderRadius: 14,
                              fontSize: 12,
                              fontWeight: 500,
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--accent-gold)',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'var(--accent-gold)'
                              e.currentTarget.style.transform = 'translateY(-1px)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border-subtle)'
                              e.currentTarget.style.transform = 'none'
                            }}
                          >
                            <span>📖</span>
                            <span>
                              Source {cite.source_id}: Page {cite.page_start}
                              {cite.page_end !== cite.page_start ? `–${cite.page_end}` : ''}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              ({Math.round(cite.score * 100)}%)
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Loading Indicator while Groq / Qdrant executes */}
          {isSending && (
            <div style={{ display: 'flex', alignItems: 'flex-start', maxWidth: '85%' }}>
              <div
                style={{
                  padding: '16px 22px',
                  borderRadius: '18px 18px 18px 4px',
                  background: 'var(--chat-card-glass)',
                  border: '1px solid var(--chat-card-border)',
                  boxShadow: 'var(--chat-card-shadow)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}
              >
                <div
                  className="spinner"
                  style={{ width: 18, height: 18, borderWidth: 2 }}
                />
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Consulting book constellations & generating grounded answer…
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Composer Card */}
        <div className="chat-composer-card">
          {/* Horizontally Scrollable Suggested Questions (Visible when chatting so questions remain accessible) */}
          {currentQuestions && currentQuestions.length > 0 && isBookReady && messages.length > 0 && (
            <div className="composer-suggested-row">
              <span className="composer-suggested-label">
                <SparklesIcon />
                <span>Suggested:</span>
              </span>
              {currentQuestions.map((q, idx) => (
                <button
                  key={idx}
                  className="composer-suggested-chip"
                  onClick={() => handleSendMessage(q)}
                  disabled={isSending}
                  title={q}
                >
                  <span style={{ color: 'var(--accent-gold)' }}>✦</span>
                  <span>{q}</span>
                </button>
              ))}
            </div>
          )}

          <div className="composer-input-row">
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending || !isBookReady}
              placeholder={
                isBookReady
                  ? `Ask a question about ${selectedBook?.title || 'this book'} (Enter to send, Shift+Enter for newline)…`
                  : 'Please index this book before asking questions…'
              }
              className="composer-textarea"
            />

            <button
              className="composer-send-btn"
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isSending || !isBookReady}
              id="chat-send-btn"
              title="Send question"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Citation Inspector Modal / Bottom Sheet */}
      {activeCitation && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setActiveCitation(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: 620,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>📖</span>
                  <h3 style={{ margin: 0, fontSize: 17, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                    Citation Reference #{activeCitation.source_id}
                  </h3>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--accent-gold)' }}>
                  Page {activeCitation.page_start}
                  {activeCitation.page_end !== activeCitation.page_start ? `–${activeCitation.page_end}` : ''}
                  {activeCitation.chapter ? ` | ${activeCitation.chapter}` : ''}
                </p>
              </div>

              <button
                className="btn btn-ghost"
                onClick={() => setActiveCitation(null)}
                style={{ padding: '4px 8px', fontSize: 16, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Quoted Excerpt */}
            <div
              style={{
                background: 'var(--bg-secondary)',
                padding: '16px 18px',
                borderRadius: 'var(--radius-md)',
                borderLeft: '4px solid var(--accent-gold)',
                fontSize: 14,
                lineHeight: 1.65,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-reading)',
                maxHeight: 260,
                overflowY: 'auto',
                marginBottom: 18,
              }}
            >
              "{activeCitation.excerpt}"
            </div>

            {/* Metadata Footer & Action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Relevance match: <strong>{Math.round(activeCitation.score * 100)}%</strong>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <Link
                  to={`/read/${encodeURIComponent(activeCitation.book_id)}?page=${activeCitation.page_start}`}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 16px' }}
                  onClick={() => setActiveCitation(null)}
                  id="open-citation-reader-btn"
                >
                  <BookOpenIcon />
                  <span>Open Page {activeCitation.page_start} in PDF Reader</span>
                </Link>
                <button
                  className="btn btn-secondary"
                  onClick={() => setActiveCitation(null)}
                  style={{ fontSize: 13, padding: '8px 14px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
