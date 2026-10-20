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

const SystemIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <path d="M8 21h8M12 17v4"/>
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

const THEME_CYCLE: Theme[] = ['dark', 'light', 'system']

export default function Nav() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(theme)
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]
    setTheme(next)
  }

  const ThemeIcon = theme === 'dark' ? MoonIcon : theme === 'light' ? SunIcon : SystemIcon
  const themeLabel = theme === 'dark' ? 'Dark mode' : theme === 'light' ? 'Light mode' : 'System mode'

  return (
    <nav className="nav" role="navigation" aria-label="Main navigation">
      <div className="nav-inner">
        {/* Logo */}
        <Link to="/" className="nav-logo" aria-label="Rewamp Library home">
          <BookIcon />
          <span className="nav-logo-text">Rewamp Library</span>
        </Link>


        {/* Desktop nav links */}
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
            <a href="/#features" className="nav-link">
              Features
            </a>
          </li>
          <li>
            <a href="/#how-it-works" className="nav-link">
              How it Works
            </a>
          </li>
        </ul>

        {/* Actions */}
        <div className="nav-actions">
          <button
            className="theme-toggle"
            onClick={cycleTheme}
            aria-label={`Current: ${themeLabel}. Click to cycle theme.`}
            title={themeLabel}
            id="theme-toggle-btn"
          >
            <ThemeIcon />
          </button>
          <Link to="/library" className="nav-cta" id="nav-explore-btn">
            Explore Library
          </Link>
        </div>
      </div>
    </nav>
  )
}
