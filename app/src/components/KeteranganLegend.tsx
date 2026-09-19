import { bands, type SiagaLevel, type SiagaTone } from '../lib/siaga'
import type { ThresholdsCm } from '../types/upstream'

type Props = {
  thresholdsCm: ThresholdsCm
  currentLevel?: SiagaLevel | null
}

// Swatches mirror the chart's reference-area fills so the legend reads as a
// key for the trend chart, not a separate colour language.
const SWATCH_CLASS: Record<SiagaTone, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-400',
  yellow: 'bg-yellow-300',
  green: 'bg-emerald-500',
}

const ACTIVE_CLASS: Record<SiagaTone, string> = {
  red: 'bg-red-50 dark:bg-red-950/40',
  orange: 'bg-orange-50 dark:bg-orange-950/40',
  yellow: 'bg-yellow-50 dark:bg-yellow-950/40',
  green: 'bg-emerald-50 dark:bg-emerald-950/40',
}

export function KeteranganLegend({ thresholdsCm, currentLevel = null }: Props) {
  return (
    <section
      className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900"
      aria-label="Keterangan status siaga"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Keterangan
      </h2>
      <ul className="mt-2 space-y-0.5">
        {bands(thresholdsCm).map((band) => {
          const isActive = band.level === currentLevel
          return (
            <li
              key={band.level}
              aria-current={isActive ? 'true' : undefined}
              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${
                isActive ? ACTIVE_CLASS[band.tone] : ''
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-3 shrink-0 rounded-sm ${SWATCH_CLASS[band.tone]}`}
              />
              <span className="tabular-nums text-zinc-600 dark:text-zinc-300">{band.rangeText}</span>
              <span
                className={`ml-auto text-xs font-semibold tracking-wide ${
                  isActive
                    ? 'text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {band.label}
                {isActive && <span className="sr-only"> (status saat ini)</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
