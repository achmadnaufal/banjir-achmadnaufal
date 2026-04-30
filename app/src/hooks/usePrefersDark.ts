import { useEffect, useState } from 'react'

const QUERY = '(prefers-color-scheme: dark)'

export function usePrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(QUERY).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(QUERY)
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return prefersDark
}
