import type { StatusIcon as IconName } from '../lib/statusTokens'

const PATHS: Record<IconName, string> = {
  // Severity reads in the glyph itself, so the icon is not just a repeat of
  // the colour: an approving tick, an outlined caution, a filled caution, a
  // klaxon.
  check: 'M4 8.5l3 3 5-6',
  alert: 'M8 2.5L14.5 13.5h-13L8 2.5zM8 6.6v3.2M8 11.6v.1',
  'alert-fill': 'M8 2.5L14.5 13.5h-13L8 2.5z',
  siren: 'M3.5 13.5v-4a4.5 4.5 0 019 0v4h-9zM8 1.5v1.5M2 4l1 1M14 4l-1 1M1.5 13.5h13',
}

type Props = {
  name: IconName
  className?: string
}

export function StatusIcon({ name, className = 'size-4' }: Props) {
  const filled = name === 'alert-fill'
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 1 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
      {filled && <path d="M8 6.4v3" stroke="var(--color-surface)" strokeWidth={1.5} />}
    </svg>
  )
}
