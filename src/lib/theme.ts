import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'
const KEY = 'bg:theme'
const listeners = new Set<() => void>()

function current(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/** Dark by default; the saved choice is applied before first paint by the inline script in index.html. */
export function setTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
  localStorage.setItem(KEY, t)
  listeners.forEach((l) => l())
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    current,
    () => 'dark' as Theme,
  )
  return { theme, setTheme }
}
