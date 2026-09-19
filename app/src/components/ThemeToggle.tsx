import type { ThemePreference } from '../hooks/useTheme'

const NEXT_LABEL: Record<ThemePreference, string> = {
  system: 'Tema: ikut sistem',
  light: 'Tema: terang',
  dark: 'Tema: gelap',
}

const GLYPH: Record<ThemePreference, string> = {
  system: '◐',
  light: '○',
  dark: '●',
}

type Props = {
  preference: ThemePreference
  onCycle: () => void
}

export function ThemeToggle({ preference, onCycle }: Props) {
  return (
    <button
      type="button"
      onClick={onCycle}
      title={NEXT_LABEL[preference]}
      aria-label={NEXT_LABEL[preference]}
      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-base text-ink-2 hover:bg-sunken hover:text-ink"
    >
      <span aria-hidden="true">{GLYPH[preference]}</span>
    </button>
  )
}
