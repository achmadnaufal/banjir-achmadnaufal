import { bands, type SiagaLevel } from '../lib/siaga'
import { statusToken } from '../lib/statusTokens'
import type { ThresholdsCm } from '../types/upstream'
import { StatusIcon } from './StatusIcon'

type Props = {
  thresholdsCm: ThresholdsCm
  currentLevel?: SiagaLevel | null
}

export function KeteranganLegend({ thresholdsCm, currentLevel = null }: Props) {
  return (
    <section className="rounded-xl bg-surface px-4 py-3.5" aria-label="Keterangan status siaga">
      <h2 className="label">Keterangan</h2>
      <ul className="mt-2.5 space-y-1.5">
        {bands(thresholdsCm).map((band) => {
          const token = statusToken(band.level)
          const isActive = band.level === currentLevel
          return (
            <li
              key={band.level}
              aria-current={isActive ? 'true' : undefined}
              className="flex items-center gap-2.5 text-sm"
            >
              <span
                aria-hidden="true"
                className="flex size-5 shrink-0 items-center justify-center rounded"
                style={{ background: token.hex, color: token.chipInk === 'light' ? '#fff' : '#0b0b0b' }}
              >
                <StatusIcon name={token.icon} className="size-3.5" />
              </span>
              <span className={`tabular-nums ${isActive ? 'text-ink' : 'text-ink-2'}`}>
                {band.rangeText}
              </span>
              <span
                className={`ml-auto text-[11px] font-semibold tracking-[0.08em] uppercase ${
                  isActive ? 'text-ink' : 'text-ink-3'
                }`}
              >
                {band.label}
                {isActive && <span className="sr-only"> (status saat ini)</span>}
              </span>
              {isActive && (
                <span
                  aria-hidden="true"
                  className="-ml-1 size-1.5 shrink-0 rounded-full"
                  style={{ background: token.hex }}
                />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
