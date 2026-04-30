import { siagaMeta, type SiagaLevel } from '../lib/siaga'

const TONE_CLASS: Record<ReturnType<typeof siagaMeta>['tone'], string> = {
  red: 'bg-red-600 text-white',
  orange: 'bg-orange-500 text-white',
  yellow: 'bg-yellow-400 text-zinc-900',
  green: 'bg-emerald-600 text-white',
}

export function SiagaBadge({ level }: { level: SiagaLevel }) {
  const meta = siagaMeta(level)
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold tracking-wide ${TONE_CLASS[meta.tone]}`}
      role="status"
      aria-label={meta.label}
    >
      {meta.label}
    </span>
  )
}
