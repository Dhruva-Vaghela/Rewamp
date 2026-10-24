import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ChatPage from '../pages/ChatPage'
import * as api from '../api/books'
import { BookDetail, BookSummary, ChatResponse } from '../types'

// Mock the books API
vi.mock('../api/books', () => ({
  fetchBooks: vi.fn(),
  fetchBook: vi.fn(),
  fetchBookIngestStatus: vi.fn(),
  sendChatMessage: vi.fn(),
  getCoverUrl: vi.fn(() => '/mock-cover.jpg'),
  triggerBookIngest: vi.fn(),
}))

const mockBooksList: BookSummary[] = [
  {
    id: 'alice-s-adventures-in-wonderland-lewis-carroll-9898',
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    cover_url: 'http://localhost:8000/api/books/alice-s-adventures-in-wonderland-lewis-carroll-9898/cover',
    page_count: 98,
    size_bytes: 1048576,
    ingest_status: 'ready',
    chunk_count: 124,
  },
  {
    id: 'frankenstein-mary-shelley',
    title: 'Frankenstein',
    author: 'Mary Shelley',
    cover_url: 'http://localhost:8000/api/books/frankenstein-mary-shelley/cover',
    page_count: 220,
    size_bytes: 2048576,
    ingest_status: 'ready',
    chunk_count: 156,
  },
]

const mockAliceDetail: BookDetail = {
  ...mockBooksList[0],
  filename: 'alice.pdf',
}

const mockFrankensteinDetail: BookDetail = {
  ...mockBooksList[1],
  filename: 'frankenstein.pdf',
}

describe('Cinematic AI Chat & Knowledge Portal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.fetchBooks).mockResolvedValue(mockBooksList)
    vi.mocked(api.fetchBook).mockImplementation(async (id: string) => {
      if (id === 'frankenstein-mary-shelley') return mockFrankensteinDetail
      return mockAliceDetail
    })
    vi.mocked(api.fetchBookIngestStatus).mockImplementation(async (id: string) => ({
      book_id: id,
      title: id.includes('frank') ? 'Frankenstein' : "Alice's Adventures in Wonderland",
      status: 'ready',
      chunk_count: id.includes('frank') ? 156 : 124,
    }))
  })

  it('renders Central Living Knowledge Portal with astrolabe rings and open book', async () => {
    render(
      <MemoryRouter initialEntries={['/chat/alice-s-adventures-in-wonderland-lewis-carroll-9898']}>
        <Routes>
          <Route path="/chat/:bookId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Alice's Adventures in Wonderland")).toBeInTheDocument()
    })

    // Check Central Knowledge Portal
    const portal = screen.getByRole('img', { name: /Central Knowledge Portal/i })
    expect(portal).toBeInTheDocument()
    expect(portal.classList.contains('knowledge-portal-container')).toBe(true)

    // Check that book stage and spine exist
    expect(portal.querySelector('.portal-open-book-rig')).toBeTruthy()
    expect(portal.querySelector('.portal-book-spine')).toBeTruthy()
    expect(portal.querySelector('.portal-ring-astrolabe')).toBeTruthy()
  })

  it('renders enchanted library background with illuminated literary fragments', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/chat/alice-s-adventures-in-wonderland-lewis-carroll-9898']}>
        <Routes>
          <Route path="/chat/:bookId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Alice's Adventures in Wonderland")).toBeInTheDocument()
    })

    // Check background literary text ribbons
    expect(screen.getByText(/Ideas connect/i)).toBeInTheDocument()
    expect(screen.getByText(/Stories reveal/i)).toBeInTheDocument()
    expect(screen.getByText(/Knowledge endures/i)).toBeInTheDocument()
    expect(screen.getByText(/Every question/i)).toBeInTheDocument()
    expect(screen.getByText(/opens another/i)).toBeInTheDocument()

    // Check illuminated parchment fragment
    const parchment = container.querySelector('.illuminated-parchment-fragment')
    expect(parchment).toBeTruthy()
  })

  it('renders welcome section with exact requested copy', async () => {
    render(
      <MemoryRouter initialEntries={['/chat/alice-s-adventures-in-wonderland-lewis-carroll-9898']}>
        <Routes>
          <Route path="/chat/:bookId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Step Inside the Story")).toBeInTheDocument()
    })

    expect(
      screen.getByText("Ask questions, uncover hidden details, and explore the world within your book.")
    ).toBeInTheDocument()

    expect(screen.getByText(/SUGGESTED QUESTIONS/i)).toBeInTheDocument()
  })

  it('renders suggested-question cards in a 2-column grid with thematic icons and handles clicks', async () => {
    const mockChatResponse: ChatResponse = {
      book_id: 'alice-s-adventures-in-wonderland-lewis-carroll-9898',
      question: 'Why did Alice follow the White Rabbit down the rabbit hole?',
      answer: 'Alice followed the White Rabbit because she was curious about its waistcoat and pocket watch.',
      citations: [
        {
          source_id: 1,
          chunk_id: 'alice_c1',
          book_id: 'alice-s-adventures-in-wonderland-lewis-carroll-9898',
          page_start: 3,
          page_end: 3,
          chapter: 'Chapter I: Down the Rabbit-Hole',
          excerpt: 'The Rabbit actually took a watch out of its waistcoat-pocket, and looked at it...',
          score: 0.92,
        },
      ],
      is_grounded: true,
      sufficient_evidence: true,
    }
    vi.mocked(api.sendChatMessage).mockResolvedValue(mockChatResponse)

    render(
      <MemoryRouter initialEntries={['/chat/alice-s-adventures-in-wonderland-lewis-carroll-9898']}>
        <Routes>
          <Route path="/chat/:bookId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(
        screen.getByText('Why did Alice follow the White Rabbit down the rabbit hole?')
      ).toBeInTheDocument()
    })

    expect(screen.getByText('What advice did the Caterpillar give Alice?')).toBeInTheDocument()
    expect(screen.getByText('Who is the Cheshire Cat and why can it disappear?')).toBeInTheDocument()
    expect(screen.getByText('What riddle does the Mad Hatter ask at the tea-party?')).toBeInTheDocument()

    // Click on the first question card
    const rabbitQuestionBtn = screen.getByRole('button', {
      name: /Why did Alice follow the White Rabbit/i,
    })
    fireEvent.click(rabbitQuestionBtn)

    await waitFor(() => {
      expect(api.sendChatMessage).toHaveBeenCalledWith(
        'alice-s-adventures-in-wonderland-lewis-carroll-9898',
        'Why did Alice follow the White Rabbit down the rabbit hole?',
        5
      )
    })

    // Check that assistant response and citations render
    await waitFor(() => {
      expect(screen.getByText(/Alice followed the White Rabbit because she was curious/i)).toBeInTheDocument()
      expect(screen.getByText(/Source 1: Page 3/i)).toBeInTheDocument()
    })
  })

  it('renders selected-book header panel with title, chunks status, and Read PDF button', async () => {
    render(
      <MemoryRouter initialEntries={['/chat/alice-s-adventures-in-wonderland-lewis-carroll-9898']}>
        <Routes>
          <Route path="/chat/:bookId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Alice's Adventures in Wonderland")).toBeInTheDocument()
    })

    expect(screen.getByText(/✓ Ready \(124 chunks\)/i)).toBeInTheDocument()
    expect(screen.getByText(/by Lewis Carroll/i)).toBeInTheDocument()

    // Check Read PDF link
    const readPdfLink = screen.getByRole('link', { name: /Read PDF/i })
    expect(readPdfLink).toBeInTheDocument()
    expect(readPdfLink.getAttribute('href')).toContain('/read/alice-s-adventures-in-wonderland-lewis-carroll-9898')
  })

  it('renders chat composer and sends message on Enter key', async () => {
    const mockChatResponse: ChatResponse = {
      book_id: 'alice-s-adventures-in-wonderland-lewis-carroll-9898',
      question: 'Tell me about the Cheshire Cat',
      answer: 'The Cheshire Cat grinned from ear to ear.',
      citations: [],
      is_grounded: true,
      sufficient_evidence: true,
    }
    vi.mocked(api.sendChatMessage).mockResolvedValue(mockChatResponse)

    render(
      <MemoryRouter initialEntries={['/chat/alice-s-adventures-in-wonderland-lewis-carroll-9898']}>
        <Routes>
          <Route path="/chat/:bookId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Ask a question about Alice's Adventures in Wonderland/i)).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText(/Ask a question about Alice's Adventures in Wonderland/i)
    fireEvent.change(textarea, { target: { value: 'Tell me about the Cheshire Cat' } })

    // Press Enter to submit
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter', shiftKey: false })

    await waitFor(() => {
      expect(api.sendChatMessage).toHaveBeenCalledWith(
        'alice-s-adventures-in-wonderland-lewis-carroll-9898',
        'Tell me about the Cheshire Cat',
        5
      )
    })
  })

  it('auto-refreshes conversation and updates book when changing the book dropdown', async () => {
    const mockChatResponse: ChatResponse = {
      book_id: 'alice-s-adventures-in-wonderland-lewis-carroll-9898',
      question: 'Why did Alice follow the White Rabbit down the rabbit hole?',
      answer: 'Curiosity drove her down the rabbit hole.',
      citations: [],
      is_grounded: true,
      sufficient_evidence: true,
    }
    vi.mocked(api.sendChatMessage).mockResolvedValue(mockChatResponse)

    render(
      <MemoryRouter initialEntries={['/chat/alice-s-adventures-in-wonderland-lewis-carroll-9898']}>
        <Routes>
          <Route path="/chat/:bookId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText("Alice's Adventures in Wonderland")).toBeInTheDocument()
    })

    // Click suggested question to populate messages
    const questionBtn = screen.getByRole('button', {
      name: /Why did Alice follow the White Rabbit/i,
    })
    fireEvent.click(questionBtn)

    await waitFor(() => {
      expect(screen.getByText(/Curiosity drove her down the rabbit hole/i)).toBeInTheDocument()
    })

    // Now switch book from the dropdown to Frankenstein
    const select = screen.getByLabelText('Select book to chat with')
    fireEvent.change(select, { target: { value: 'frankenstein-mary-shelley' } })

    // Verify auto-refresh: title updates to Frankenstein, chunk count to 156, and previous Alice message is cleared
    await waitFor(() => {
      expect(screen.getByText('Frankenstein')).toBeInTheDocument()
      expect(screen.getByText(/by Mary Shelley/i)).toBeInTheDocument()
      expect(screen.getByText(/✓ Ready \(156 chunks\)/i)).toBeInTheDocument()
      expect(screen.queryByText(/Curiosity drove her down the rabbit hole/i)).not.toBeInTheDocument()
      expect(screen.getByText(/What drove Victor Frankenstein to create the creature\?/i)).toBeInTheDocument()
    })
  })
})
