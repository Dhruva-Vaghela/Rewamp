import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Nav from '../components/Nav'
import {
  fetchBooks,
  fetchBook,
  getCoverUrl,
  sendChatMessage,
  triggerBookIngest,
  fetchBookIngestStatus,
} from '../api/books'
import { BookSummary, BookDetail, ChatMessage, Citation } from '../types'

// Icons
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m22 2-7 20-4-9-9-4Z"/>
    <path d="M22 2 11 13"/>
  </svg>
)

const SparklesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
  </svg>
)

const BookOpenIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
)

const RefreshCwIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/>
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
    <path d="M8 16H3v5"/>
  </svg>
)

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
}

const GENERIC_QUESTIONS = [
  'What are the primary themes and motifs explored in this book?',
  'Summarize the opening chapter and the initial conflict.',
  'Who are the main characters introduced early in the story?',
  'What major turning point or crisis occurs in the narrative?',
]

export default function ChatPage() {
  const { bookId } = useParams<{ bookId?: string }>()
  const navigate = useNavigate()

  const [allBooks, setAllBooks] = useState<BookSummary[]>([])
  const [selectedBook, setSelectedBook] = useState<BookDetail | null>(null)
  const [loadingBook, setLoadingBook] = useState(true)
  const [ingestStatus, setIngestStatus] = useState<string>('pending')
  const [isIngesting, setIsIngesting] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [topK, setTopK] = useState(5)

  // Inspection & diagnostic state
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isSending])

  // Load all books for catalog dropdown / selection
  useEffect(() => {
    fetchBooks()
      .then((data) => {
        setAllBooks(data)
        // If no bookId in URL, default to first ready book or first book
        if (!bookId && data.length > 0) {
          const readyBook = data.find((b) => b.ingest_status === 'ready') || data[0]
          navigate(`/chat/${encodeURIComponent(readyBook.id)}`, { replace: true })
        }
      })
      .catch(console.error)
  }, [bookId, navigate])

  // Load selected book details and ingestion status
  useEffect(() => {
    if (!bookId) return

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
  }, [bookId])

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
  }

  const currentQuestions = useMemo(() => {
    if (!bookId) return GENERIC_QUESTIONS
    return SUGGESTED_QUESTIONS[bookId] || GENERIC_QUESTIONS
  }, [bookId])

  const isBookReady = ingestStatus === 'ready'

  return (
    <div className="chat-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', paddingTop: 64 }}>
      <Nav />

      {/* Main Workspace Layout */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 1200, width: '100%', margin: '0 auto', padding: '24px 20px 28px' }}>
        
        {/* Book Header Bar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            padding: '14px 20px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-card)',
            marginBottom: 16,
          }}
        >
          {/* Left: Book Thumbnail & Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {selectedBook && (
              <img
                src={selectedBook.cover_url || getCoverUrl(selectedBook.id)}
                alt={selectedBook.title}
                style={{
                  width: 44,
                  height: 60,
                  objectFit: 'cover',
                  borderRadius: 4,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              />
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                  {selectedBook ? selectedBook.title : 'AI Reading Workspace'}
                </h1>

                {/* Status Badge */}
                {isBookReady ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    ✓ Ready ({selectedBook?.chunk_count || 0} chunks)
                  </span>
                ) : ingestStatus === 'processing' || isIngesting ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#3b82f6',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    <span className="spinner-mini" style={{ width: 8, height: 8, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    Indexing Book…
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                    }}
                  >
                    Needs Indexing
                  </span>
                )}
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                {selectedBook ? `by ${selectedBook.author}` : 'Select a book to ask grounded questions'}
              </p>
            </div>
          </div>

          {/* Right: Actions & Book Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Book Selector Dropdown */}
            {allBooks.length > 0 && (
              <select
                aria-label="Select book to chat with"
                value={bookId || ''}
                onChange={(e) => navigate(`/chat/${encodeURIComponent(e.target.value)}`)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 13,
                  cursor: 'pointer',
                  maxWidth: 200,
                }}
              >
                {allBooks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} {b.ingest_status === 'ready' ? '✓' : ''}
                  </option>
                ))}
              </select>
            )}

            {/* Read Book Button */}
            {bookId && (
              <Link
                to={`/read/${encodeURIComponent(bookId)}`}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 13 }}
                title="Open PDF Reader"
              >
                <BookOpenIcon />
                <span>Read PDF</span>
              </Link>
            )}


            {/* Reset Chat */}
            {messages.length > 0 && (
              <button
                className="btn btn-ghost"
                onClick={handleResetChat}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 10px', fontSize: 13 }}
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
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>💡</span>
              <div>
                <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>
                  This book has not been indexed for AI retrieval yet.
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                  Extracting text and storing vectors in Qdrant Cloud enables instant, grounded answers with citations.
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
          }}
        >
          {messages.length === 0 ? (
            /* Welcome Empty State with Suggested Prompts */
            <div
              style={{
                margin: 'auto',
                maxWidth: 680,
                textAlign: 'center',
                padding: '40px 20px',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(201, 168, 76, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 18px',
                  color: 'var(--accent-gold)',
                  fontSize: 24,
                }}
              >
                <SparklesIcon />
              </div>

              <h2 style={{ fontSize: 22, fontFamily: 'var(--font-display)', margin: '0 0 8px', color: 'var(--text-primary)' }}>
                Ask anything about {selectedBook ? `"${selectedBook.title}"` : 'this book'}
              </h2>
              <p style={{ margin: '0 0 28px', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                Every answer is grounded strictly in the text using Qdrant vector retrieval and verified Groq LLM inference, with exact page citations.
              </p>

              {/* Suggested Questions */}
              <div style={{ textAlign: 'left', width: '100%' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, textAlign: 'center' }}>
                  Suggested Questions
                </p>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  {currentQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      className="btn"
                      onClick={() => handleSendMessage(q)}
                      disabled={isSending || !isBookReady}
                      style={{
                        padding: '10px 18px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-card)',
                        borderRadius: 24,
                        textAlign: 'left',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        lineHeight: 1.4,
                        transition: 'all 0.2s ease',
                        cursor: isBookReady ? 'pointer' : 'not-allowed',
                        opacity: isBookReady ? 1 : 0.6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                      onMouseEnter={(e) => {
                        if (isBookReady) {
                          e.currentTarget.style.borderColor = 'var(--accent-gold)'
                          e.currentTarget.style.transform = 'translateY(-1px)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-card)'
                        e.currentTarget.style.transform = 'none'
                      }}
                    >
                      <span style={{ color: 'var(--accent-gold)' }}>✦</span>
                      <span>{q}</span>
                    </button>
                  ))}
                </div>
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
                    background: msg.sender === 'user' ? 'var(--gradient-cta)' : 'var(--bg-card)',
                    color: msg.sender === 'user' ? '#0d0b08' : 'var(--text-primary)',
                    border: msg.sender === 'user' ? 'none' : '1px solid var(--border-card)',
                    boxShadow: 'var(--shadow-card)',
                    fontSize: 14.5,
                    lineHeight: 1.65,
                    fontFamily: msg.sender === 'assistant' ? 'var(--font-reading)' : 'var(--font-body)',
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
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-card)',
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  className="spinner"
                  style={{ width: 18, height: 18, borderWidth: 2 }}
                />
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                  Searching Qdrant vectors & generating grounded answer with Groq…
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Control Bar */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-lg)',
            padding: '12px 16px',
            boxShadow: 'var(--shadow-card)',
            position: 'sticky',
            bottom: 0,
            zIndex: 10,
          }}
        >
          {/* Horizontally Scrollable Suggested Questions (Always visible above input) */}
          {currentQuestions && currentQuestions.length > 0 && isBookReady && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                paddingBottom: 8,
                marginBottom: 8,
                borderBottom: '1px solid var(--border-subtle)',
                scrollbarWidth: 'none',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--accent-gold)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                  fontWeight: 500,
                  marginRight: 4,
                }}
              >
                <SparklesIcon />
                <span>Suggested:</span>
              </span>
              {currentQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q)}
                  disabled={isSending}
                  style={{
                    flexShrink: 0,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 20,
                    padding: '5px 12px',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    cursor: isSending ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSending) {
                      e.currentTarget.style.borderColor = 'var(--accent-gold)'
                      e.currentTarget.style.color = 'var(--text-primary)'
                      e.currentTarget.style.background = 'var(--bg-card-hover)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                    e.currentTarget.style.background = 'var(--bg-secondary)'
                  }}
                  title={q}
                >
                  <span style={{ color: 'var(--accent-gold)' }}>✦</span>
                  <span>{q}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
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
              style={{
                flex: 1,
                resize: 'none',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: 14,
                lineHeight: 1.5,
                fontFamily: 'var(--font-body)',
              }}
            />

            <button
              className="btn btn-primary"
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isSending || !isBookReady}
              id="chat-send-btn"
              style={{
                borderRadius: '50%',
                width: 42,
                height: 42,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                opacity: (!input.trim() || isSending || !isBookReady) ? 0.5 : 1,
                cursor: (!input.trim() || isSending || !isBookReady) ? 'not-allowed' : 'pointer',
              }}
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
