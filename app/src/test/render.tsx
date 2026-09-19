import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { LocaleProvider } from '../i18n/LocaleProvider'
import type { Locale } from '../i18n/locale'

/**
 * Renders inside the locale provider. Pass a locale to pin the language —
 * the provider reads localStorage, so tests must set it explicitly rather
 * than depend on whatever a previous test left behind.
 */
export function renderWithLocale(ui: ReactElement, locale: Locale = 'en') {
  try {
    localStorage.setItem('banjir:locale', locale)
  } catch {
    // ignore — the provider falls back to the default
  }
  return render(<LocaleProvider>{ui}</LocaleProvider>)
}
