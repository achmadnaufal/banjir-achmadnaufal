export const LOCALES = ['en', 'id'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'EN',
  id: 'ID',
}

export const LOCALE_NAME: Record<Locale, string> = {
  en: 'English',
  id: 'Bahasa Indonesia',
}

/** BCP 47 tags for Intl and the document's lang attribute. */
export const LOCALE_TAG: Record<Locale, string> = {
  en: 'en',
  id: 'id-ID',
}

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v)
}
