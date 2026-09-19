import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LocaleContext, type LocaleContextValue } from './context'
import { DEFAULT_LOCALE, isLocale, LOCALE_TAG, type Locale } from './locale'
import { MESSAGES } from './messages'

const STORAGE_KEY = 'banjir:locale'

function readStored(): Locale {
  if (typeof localStorage === 'undefined') return DEFAULT_LOCALE
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return isLocale(v) ? v : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStored())

  // The document's lang attribute has to track the rendered language for
  // screen readers and for the browser's own translation prompt. The static
  // lang="id" in index.html stays as-is: it describes the prerendered
  // Indonesian copy that crawlers see.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = LOCALE_TAG[locale]
    }
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // quota or privacy mode — the choice just won't persist
    }
  }, [])

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, tag: LOCALE_TAG[locale], t: MESSAGES[locale], setLocale }),
    [locale, setLocale],
  )

  return <LocaleContext value={value}>{children}</LocaleContext>
}
