import { useI18n } from '../i18n/useI18n'
import type { ThemePreference } from '../hooks/useTheme'

const GLYPH: Record<ThemePreference, string> = {
  system: '\u25d0',
  light: '\u25cb',
  dark: '\u25cf',
}

type Props = {
  preference: ThemePreference
  onCycle: () => void
}

export function ThemeToggle({ preference, onCycle }: Props) {
  const { t } = useI18n()
  const label =
    preference === 'system' ? t.themeSystem : preference === 'light' ? t.themeLight : t.themeDark

  return (
    <button
      type="button"
      onClick={onCycle}
      title={label}
      aria-label={label}
      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-base text-ink-2 hover:bg-sunken hover:text-ink"
    >
      <span aria-hidden="true">{GLYPH[preference]}</span>
    </button>
  )
}
