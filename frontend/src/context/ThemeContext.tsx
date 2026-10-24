import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Theme } from '../types'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: 'dark' | 'light'
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  resolvedTheme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
})

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') return getSystemTheme()
  return theme === 'light' ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = (localStorage.getItem('rewamp-theme') || localStorage.getItem('lumina-theme')) as Theme | null
      return stored || 'dark'
    } catch {
      return 'dark'
    }
  })

  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>(getSystemTheme)

  // Listen for system theme changes when theme === 'system'
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const resolvedTheme: 'dark' | 'light' = theme === 'system' ? systemTheme : (theme === 'light' ? 'light' : 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem('rewamp-theme', newTheme)
    } catch {}
    const resolved = resolveTheme(newTheme)
    document.documentElement.setAttribute('data-theme', resolved)
  }, [])

  const toggleTheme = useCallback(() => {
    // Single click immediately flips from light to dark, or dark to light.
    // Removes any unintended desktop/system icon intermediate state.
    const nextTheme: 'dark' | 'light' = resolvedTheme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
  }, [resolvedTheme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

