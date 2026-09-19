import { use } from 'react'
import { LocaleContext, type LocaleContextValue } from './context'

export function useI18n(): LocaleContextValue {
  const ctx = use(LocaleContext)
  if (ctx === null) throw new Error('useI18n must be used inside a LocaleProvider')
  return ctx
}
