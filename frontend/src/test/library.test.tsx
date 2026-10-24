import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '../context/ThemeContext'
import Nav from '../components/Nav'
import LibraryPage from '../pages/LibraryPage'
import * as booksApi from '../api/books'
import { BookSummary } from '../types'

const MOCK_CATALOG: BookSummary[] = [
  {
    id: 'alice-s-adventures-in-wonderland-lewis-carroll-9898',
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    cover_url: '/api/books/alice-s-adventures-in-wonderland-lewis-carroll-9898/cover',
    size_bytes: 1420000,
    page_count: 98,
    ingest_status: 'ready',
    chunk_count: 124,
  },
  {
    id: 'frankenstein-mary-shelley',
    title: 'Frankenstein; Or, The Modern Prometheus',
    author: 'Mary Wollstonecraft Shelley',
    cover_url: '/api/books/frankenstein-mary-shelley/cover',
    size_bytes: 2150000,
    page_count: 280,
    ingest_status: 'ready',
    chunk_count: 421,
  },
  {
    id: 'phantastes-george-macdonald-9895',
    title: 'Phantastes: A Faerie Romance for Men and Women',
    author: 'George MacDonald',
    cover_url: '/api/books/phantastes-george-macdonald-9895/cover',
    size_bytes: 1890000,
    page_count: 210,
    ingest_status: 'ready',
    chunk_count: 367,
  },
  {
    id: 'pride-and-prejudice-jane-austen',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    cover_url: '/api/books/pride-and-prejudice-jane-austen/cover',
    size_bytes: 2450000,
    page_count: 340,
    ingest_status: 'ready',
    chunk_count: 593,
  },
  {
    id: 'the-adventures-of-sherlock-holmes-arthur-conan-doyle-9924',
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    cover_url: '/api/books/the-adventures-of-sherlock-holmes-arthur-conan-doyle-9924/cover',
    size_bytes: 2850000,
    page_count: 312,
    ingest_status: 'ready',
    chunk_count: 512,
  },
  {
    id: 'the-great-gatsby-f-scott-fitzgerald',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    cover_url: '/api/books/the-great-gatsby-f-scott-fitzgerald/cover',
    size_bytes: 1650000,
    page_count: 180,
    ingest_status: 'ready',
    chunk_count: 310,
  },
  {
    id: 'the-mill-on-the-floss-george-eliot-9931',
    title: 'The Mill on the Floss',
    author: 'George Eliot',
    cover_url: '/api/books/the-mill-on-the-floss-george-eliot-9931/cover',
    size_bytes: 3200000,
    page_count: 490,
    ingest_status: 'ready',
    chunk_count: 894,
  },
  {
    id: 'the-three-musketeers-alexandre-dumas-9929',
    title: 'The Three Musketeers',
    author: 'Alexandre Dumas',
    cover_url: '/api/books/the-three-musketeers-alexandre-dumas-9929/cover',
    size_bytes: 4100000,
    page_count: 620,
    ingest_status: 'ready',
    chunk_count: 977,
  },
]

describe('Navigation Simplification (Section 10)', () => {
  it('strictly contains Rewamp logo, Library, AI Chat, and Theme Toggle without Features or How It Works', () => {
    render(
      <MemoryRouter initialEntries={['/library']}>
        <ThemeProvider>
          <Nav />
        </ThemeProvider>
      </MemoryRouter>
    )

    // Verify logo
    expect(screen.getByRole('link', { name: /rewamp library home/i })).toBeInTheDocument()

    // Verify Library link
    const libraryLink = screen.getByRole('link', { name: /^library$/i })
    expect(libraryLink).toBeInTheDocument()
    expect(libraryLink).toHaveAttribute('href', '/library')
    expect(libraryLink).toHaveClass('active')

    // Verify AI Chat link
    const chatLink = screen.getByRole('link', { name: /^ai chat$/i })
    expect(chatLink).toBeInTheDocument()
    expect(chatLink).toHaveAttribute('href', '/chat')
    expect(chatLink).not.toHaveClass('active')

    // Verify Theme toggle button
    expect(screen.getByRole('button', { name: /mode/i })).toBeInTheDocument()

    // Confirm Features and How It Works are completely absent
    expect(screen.queryByText(/features/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/how it works/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/explore library/i)).not.toBeInTheDocument()
  })

  it('updates the active state indicator when on AI chat route', () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <ThemeProvider>
          <Nav />
        </ThemeProvider>
      </MemoryRouter>
    )

    const libraryLink = screen.getByRole('link', { name: /^library$/i })
    const chatLink = screen.getByRole('link', { name: /^ai chat$/i })

    expect(chatLink).toHaveClass('active')
    expect(libraryLink).not.toHaveClass('active')
  })
})

describe('Enchanted Library UI & Browsing Experience', () => {
  beforeEach(() => {
    vi.spyOn(booksApi, 'fetchBooks').mockResolvedValue(MOCK_CATALOG)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the compact cinematic library header with exact required copy and dust effects', async () => {
    render(
      <MemoryRouter initialEntries={['/library']}>
        <ThemeProvider>
          <LibraryPage />
        </ThemeProvider>
      </MemoryRouter>
    )

    // Eyebrow
    expect(screen.getByText('THE REWAMP COLLECTION')).toBeInTheDocument()

    // Heading
    expect(screen.getByRole('heading', { level: 1, name: 'Choose Your Next World' })).toBeInTheDocument()

    // Description
    expect(
      screen.getByText('Explore timeless stories, uncover hidden secrets, and discover more within every page.')
    ).toBeInTheDocument()

    // Collection count & ready status
    await waitFor(() => {
      expect(screen.getByText('8 of 8 Ready')).toBeInTheDocument()
    })

    // Index all button
    expect(screen.getByRole('button', { name: /all indexed/i })).toBeInTheDocument()
  })

  it('renders all 8 real volumes in the catalog with authentic book details and actions', async () => {
    render(
      <MemoryRouter initialEntries={['/library']}>
        <ThemeProvider>
          <LibraryPage />
        </ThemeProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(8)
    })

    // Confirm book IDs and titles are present
    for (const book of MOCK_CATALOG) {
      expect(screen.getByText(book.title)).toBeInTheDocument()
      expect(screen.getByText(book.author)).toBeInTheDocument()
      expect(document.getElementById(`book-card-${book.id}`)).toBeInTheDocument()
      expect(document.getElementById(`chat-btn-${book.id}`)).toBeInTheDocument()
      expect(document.getElementById(`read-btn-${book.id}`)).toBeInTheDocument()
    }

    // Check count badge
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText(/Volumes Available/i)).toBeInTheDocument()
  })

  it('filters books by title and updates collection count dynamically', async () => {
    render(
      <MemoryRouter initialEntries={['/library']}>
        <ThemeProvider>
          <LibraryPage />
        </ThemeProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(8)
    })

    const searchInput = screen.getByLabelText(/search books by title or author/i)

    // Search for Frankenstein
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Frankenstein' } })
    })

    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByText('Frankenstein; Or, The Modern Prometheus')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText(/Volume Matched/i)).toBeInTheDocument()

    // Clear search using the clear button
    const clearBtn = screen.getByRole('button', { name: /clear search/i })
    await act(async () => {
      fireEvent.click(clearBtn)
    })

    expect(screen.getAllByRole('article')).toHaveLength(8)
  })

  it('filters books by author correctly', async () => {
    render(
      <MemoryRouter initialEntries={['/library']}>
        <ThemeProvider>
          <LibraryPage />
        </ThemeProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(8)
    })

    const searchInput = screen.getByLabelText(/search books by title or author/i)

    // Search for Conan Doyle
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Conan Doyle' } })
    })

    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByText('The Adventures of Sherlock Holmes')).toBeInTheDocument()
  })

  it('displays a tasteful enchanted empty state when no manuscripts match search', async () => {
    render(
      <MemoryRouter initialEntries={['/library']}>
        <ThemeProvider>
          <LibraryPage />
        </ThemeProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(8)
    })

    const searchInput = screen.getByLabelText(/search books by title or author/i)

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'Atlantis Chronicles' } })
    })

    expect(screen.queryAllByRole('article')).toHaveLength(0)
    expect(screen.getByText('No Volumes Found')).toBeInTheDocument()
    expect(screen.getByText(/"Atlantis Chronicles"/)).toBeInTheDocument()

    // Test Show All Volumes button restores library
    const showAllBtn = screen.getByRole('button', { name: /show all volumes/i })
    await act(async () => {
      fireEvent.click(showAllBtn)
    })

    expect(screen.getAllByRole('article')).toHaveLength(8)
  })

  it('handles image loading error gracefully with antique decorative fallback cover', async () => {
    render(
      <MemoryRouter initialEntries={['/library']}>
        <ThemeProvider>
          <LibraryPage />
        </ThemeProvider>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(8)
    })

    // Find the first book cover image and simulate an error
    const firstImg = screen.getAllByRole('img')[0]
    await act(async () => {
      fireEvent.error(firstImg)
    })

    // The fallback decorative container should now be active for that card
    const firstCard = screen.getAllByRole('article')[0]
    expect(firstCard.querySelector('.book-fallback-cover')).toBeInTheDocument()
    expect(firstCard.querySelector('.fallback-ornament')).toBeInTheDocument()
  })

  it('renders the 3D floating open books magical background with visibly curved pages and particles', async () => {
    let container!: HTMLElement
    await act(async () => {
      const res = render(
        <MemoryRouter initialEntries={['/library']}>
          <ThemeProvider>
            <LibraryPage />
          </ThemeProvider>
        </MemoryRouter>
      )
      container = res.container
    })

    await waitFor(() => {
      expect(screen.getAllByRole('article')).toHaveLength(8)
    })

    // Verify backdrop container exists with pointer-events: none
    const backdrop = container!.querySelector('.floating-library-backdrop')
    expect(backdrop).toBeInTheDocument()

    // Verify 8-15 floating OPEN books (12 strategically positioned books)
    const openBooks = container!.querySelectorAll('.open-book-3d')
    expect(openBooks.length).toBeGreaterThanOrEqual(8)
    expect(openBooks.length).toBeLessThanOrEqual(15)

    // Every open book has two separate curved page wings forming a V-shape
    const leftPages = container!.querySelectorAll('.page-leaf-left')
    const rightPages = container!.querySelectorAll('.page-leaf-right')
    expect(leftPages.length).toBe(openBooks.length)
    expect(rightPages.length).toBe(openBooks.length)

    // Every page has cylindrical curvature highlight
    expect(container.querySelectorAll('.page-curl-highlight').length).toBe(openBooks.length * 2)

    // Spine folds and radiating golden spine luminescence
    expect(container.querySelectorAll('.open-book-spine-fold').length).toBe(openBooks.length)
    expect(container.querySelectorAll('.open-book-spine-glow').length).toBe(openBooks.length)

    // Verify golden dust motes are present
    const dustMotes = container.querySelectorAll('.backdrop-dust-mote')
    expect(dustMotes.length).toBeGreaterThanOrEqual(10)
  })
})
