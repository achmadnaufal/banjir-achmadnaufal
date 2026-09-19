import { createContext } from 'react'
import type { Locale } from './locale'
import type { Messages } from './messages'

export type LocaleContextValue = {
  locale: Locale
  /** BCP 47 tag for Intl formatters. */
  tag: string
  t: Messages
  setLocale: (next: Locale) => void
}

export const LocaleContext = createContext<LocaleContextValue | null>(null)
