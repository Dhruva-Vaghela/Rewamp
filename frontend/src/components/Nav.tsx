import { Link, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { Theme } from '../types'

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
  </svg>
)

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const BookIcon = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill="var(--accent-gold)" fillOpacity="0.12"/>
    <path d="M8 6h11a3 3 0 0 1 3 3v17a1 1 0 0 1-1 1H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="var(--accent-gold)" opacity="0.85"/>
    <path d="M19 6h1a3 3 0 0 1 3 3v17a1 1 0 0 1-1 1h-3V6z" fill="var(--accent-gold-dark)"/>
    <path d="M10 11h9M10 14h9M10 17h6" stroke="var(--bg-primary)" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
)

export default function Nav() {
  const { resolvedTheme, toggleTheme } = useTheme()
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  const ThemeIcon = resolvedTheme === 'dark' ? MoonIcon : SunIcon
  const themeLabel = resolvedTheme === 'dark' ? 'Dark mode' : 'Light mode'
  const nextThemeLabel = resolvedTheme === 'dark' ? 'light mode' : 'dark mode'

  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      <div className="nav-inner">
        {/* Logo */}
        <Link to="/" className="nav-logo" aria-label="Rewamp Library home">
          <BookIcon />
          <span className="nav-logo-text">Rewamp Library</span>
        </Link>


        {/* Simplified Fantasy Navigation links: Library and AI Chat only */}
        <ul className="nav-links" role="list">
          <li>
            <Link
              to="/library"
              className={`nav-link ${isActive('/library') ? 'active' : ''}`}
            >
              Library
            </Link>
          </li>
          <li>
            <Link
              to="/chat"
              className={`nav-link ${location.pathname.startsWith('/chat') ? 'active' : ''}`}
            >
              AI Chat
            </Link>
          </li>
        </ul>

        {/* Theme Toggle */}
        <div className="nav-actions">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Current: ${themeLabel}. Click to switch to ${nextThemeLabel}.`}
            title={`Switch to ${nextThemeLabel}`}
            id="theme-toggle-btn"
          >
            <ThemeIcon />
          </button>
        </div>
      </div>
    </nav>
  )
}
