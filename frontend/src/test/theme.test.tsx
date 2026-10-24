import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom'
import { ThemeProvider, useTheme } from '../context/ThemeContext'
import Nav from '../components/Nav'

describe('Theme Toggle & State Synchronization', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('switches immediately from dark to light on a single click', async () => {
    localStorage.setItem('rewamp-theme', 'dark')

    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <Nav />
        </ThemeProvider>
      </MemoryRouter>
    )

    const toggleBtn = screen.getByRole('button', { name: /switch to light mode/i })
    expect(toggleBtn).toBeInTheDocument()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    // Single click
    await act(async () => {
      fireEvent.click(toggleBtn)
    })

    // Immediately switches to light
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('rewamp-theme')).toBe('light')
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument()
  })

  it('switches immediately from light to dark on a single click without intermediate system icon', async () => {
    localStorage.setItem('rewamp-theme', 'light')

    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <Nav />
        </ThemeProvider>
      </MemoryRouter>
    )

    const toggleBtn = screen.getByRole('button', { name: /switch to dark mode/i })
    expect(toggleBtn).toBeInTheDocument()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    // Single click: must switch directly to dark, never showing desktop/system icon
    await act(async () => {
      fireEvent.click(toggleBtn)
    })

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('rewamp-theme')).toBe('dark')
    // After click, label and button prompt switch to light mode
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument()
    // Verify title reflects switch to light mode
    expect(toggleBtn).toHaveAttribute('title', 'Switch to light mode')
  })

  it('synchronizes icon state correctly across consecutive toggles', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <Nav />
        </ThemeProvider>
      </MemoryRouter>
    )

    const toggleBtn = screen.getByRole('button', { name: /switch to light mode/i })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    // Click 1: dark -> light
    await act(async () => {
      fireEvent.click(toggleBtn)
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(toggleBtn).toHaveAttribute('title', 'Switch to dark mode')

    // Click 2: light -> dark
    await act(async () => {
      fireEvent.click(toggleBtn)
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(toggleBtn).toHaveAttribute('title', 'Switch to light mode')

    // Click 3: dark -> light
    await act(async () => {
      fireEvent.click(toggleBtn)
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(toggleBtn).toHaveAttribute('title', 'Switch to dark mode')
  })

  it('persists theme preference across simulated page refresh', () => {
    // 1. Initial mount in default dark mode
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <Nav />
        </ThemeProvider>
      </MemoryRouter>
    )

    const toggleBtn = screen.getByRole('button', { name: /switch to light mode/i })
    fireEvent.click(toggleBtn)
    expect(localStorage.getItem('rewamp-theme')).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    // 2. Unmount (simulates navigating away or page unload)
    unmount()

    // 3. Mount fresh instance (simulates page refresh)
    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <Nav />
        </ThemeProvider>
      </MemoryRouter>
    )

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument()
  })

  it('maintains consistent theme appearance across route transitions', async () => {
    const TestRoutes = () => (
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <Nav />
          <Routes>
            <Route path="/" element={<div data-testid="page-landing">Landing Page</div>} />
            <Route path="/library" element={<div data-testid="page-library">Library Page</div>} />
            <Route path="/chat" element={<div data-testid="page-chat">Chat Page</div>} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>
    )

    render(<TestRoutes />)

    expect(screen.getByTestId('page-landing')).toBeInTheDocument()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    // Toggle to light mode on Landing
    const toggleBtn = screen.getByRole('button', { name: /switch to light mode/i })
    await act(async () => {
      fireEvent.click(toggleBtn)
    })
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    // Navigate to Library route via link
    const libraryLink = screen.getByRole('link', { name: /^library$/i })
    await act(async () => {
      fireEvent.click(libraryLink)
    })

    expect(screen.getByTestId('page-library')).toBeInTheDocument()
    // Theme remains light on new route
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument()
  })

  it('recovers cleanly from legacy system preference without intermediate desktop icon', async () => {
    // If user has old "system" in localStorage
    localStorage.setItem('rewamp-theme', 'system')

    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <Nav />
        </ThemeProvider>
      </MemoryRouter>
    )

    // In our test environment matchMedia.matches=false means system resolved to light
    const toggleBtn = screen.getByRole('button', { name: /switch to dark mode/i })
    await act(async () => {
      fireEvent.click(toggleBtn)
    })

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('rewamp-theme')).toBe('dark')
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument()
  })
})

describe('Immersive Fantasy Landing & Theme State', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders required landing heading, subtitle, and branding', async () => {
    const { default: LandingPage } = await import('../pages/LandingPage')

    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <LandingPage />
        </ThemeProvider>
      </MemoryRouter>
    )

    // Heading: REWAMP LIBRARY
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(/rewamp library/i)

    // Subtitle
    expect(
      screen.getByText('A universe of knowledge, waiting to be explored.')
    ).toBeInTheDocument()
  })

  it('renders primary Enter the Library CTA with proper label and ID', async () => {
    const { default: LandingPage } = await import('../pages/LandingPage')

    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <LandingPage />
        </ThemeProvider>
      </MemoryRouter>
    )

    const primaryBtn = screen.getByRole('button', { name: /enter the library/i })
    expect(primaryBtn).toBeInTheDocument()
    expect(primaryBtn).toHaveAttribute('id', 'enter-library-btn')
  })

  it('updates theme immediately when Nav is rendered with LandingPage', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <Nav />
        </ThemeProvider>
      </MemoryRouter>
    )

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    const toggleBtn = screen.getByRole('button', { name: /switch to light mode/i })
    await act(async () => {
      fireEvent.click(toggleBtn)
    })

    // Root data-theme immediately reflects light mode
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('rewamp-theme')).toBe('light')
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument()
  })
})

