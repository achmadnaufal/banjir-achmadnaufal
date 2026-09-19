import { LOCALES, LOCALE_LABEL, LOCALE_NAME } from '../i18n/locale'
import { useI18n } from '../i18n/useI18n'

export function LocaleToggle() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div
      role="group"
      aria-label={t.languageLabel}
      className="flex shrink-0 gap-0.5 rounded-lg bg-sunken p-0.5"
    >
      {LOCALES.map((code) => {
        const active = code === locale
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            title={LOCALE_NAME[code]}
            onClick={() => setLocale(code)}
            className={`min-h-8 min-w-8 rounded-[6px] px-1.5 text-[11px] font-semibold tracking-wide transition-colors ${
              active
                ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                : 'text-ink-3 hover:text-ink-2'
            }`}
          >
            {LOCALE_LABEL[code]}
          </button>
        )
      })}
    </div>
  )
}
