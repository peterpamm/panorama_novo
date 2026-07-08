import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function resolveInitial(): Theme {
  const stored = localStorage.getItem('pf-theme') as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(resolveInitial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('pf-theme', theme)
  }, [theme])

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme: () => setTheme(t => (t === 'dark' ? 'light' : 'dark')),
  }
}
