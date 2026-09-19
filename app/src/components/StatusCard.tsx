import { formatStamp, timeSince, trendArrow } from '../lib/format'
import { classify, trend, type Trend } from '../lib/siaga'
import { statusToken } from '../lib/statusTokens'
import type { HistoryResponse, SnapshotRow } from '../types/upstream'
import { SiagaBadge } from './SiagaBadge'
import { StatsRow } from './StatsRow'

type Props = {
  snapshot: SnapshotRow
  isStale: boolean
  now: Date
  stats?: HistoryResponse | null
}

// The arrow carries the direction in colour; the number itself stays in ink,
// because none of the status steps clear 4.5:1 as text on the light surface.
const ARROW_CLASS: Record<Trend, string> = {
  up: 'text-critical',
  down: 'text-good',
  flat: 'text-ink-3',
}

const TREND_LABEL: Record<Trend, string> = {
  up: 'naik',
  down: 'turun',
  flat: 'datar',
}

export function StatusCard({ snapshot, isStale, now, stats }: Props) {
  const level = classify(snapshot.levelCm, snapshot.thresholdsCm)
  const token = statusToken(level)
  const direction = trend(snapshot.prevLevelCm, snapshot.levelCm)
  const delta =
    snapshot.prevLevelCm === null
      ? null
      : Math.round((snapshot.levelCm - snapshot.prevLevelCm) * 10) / 10

  const cm = Math.round(snapshot.levelCm)
  const metres = (cm / 100).toFixed(2)

  return (
    <section aria-label="Status terkini" className="overflow-hidden rounded-xl bg-surface">
      {/* The rail restates severity at full width, so the page itself changes
          character with the band rather than only a small chip doing so. */}
      <div className="h-1 w-full" style={{ background: token.hex }} />

      <div className="px-5 pt-4 pb-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <SiagaBadge level={level} size="lg" />
          {isStale && (
            <span className="label text-ink-2">data tertunda</span>
          )}
          <span className="label ml-auto shrink-0">
            {timeSince(snapshot.observedAt, now)}
          </span>
        </div>

        {/* Hero figure: proportional figures, not tabular — equal-width digits
            make a three-digit number look loose at display size. */}
        <div className="mt-4 flex items-baseline gap-2" data-testid="hero-level">
          <span className="text-[68px] leading-[0.9] font-semibold tracking-[-0.03em] sm:text-[80px]">
            {cm}
          </span>
          <span className="pb-1 text-xl font-medium text-ink-3">cm</span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
          <span>{metres} m</span>
          <span aria-hidden="true" className="text-hairline-strong">·</span>
          {delta === null ? (
            <span className="text-ink-3">belum ada bacaan sebelumnya</span>
          ) : (
            <span>
              <span aria-hidden="true" className={`mr-1 font-semibold ${ARROW_CLASS[direction]}`}>
                {trendArrow(direction)}
              </span>
              <span className="sr-only">{TREND_LABEL[direction]} </span>
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)} cm dari bacaan sebelumnya
            </span>
          )}
        </div>

        <p className="mt-1 text-xs text-ink-3">Terbaca {formatStamp(snapshot.observedAt)}</p>
      </div>

      {stats && (
        <div className="border-t border-hairline px-5 py-4">
          <StatsRow history={stats} snapshot={snapshot} now={now} />
        </div>
      )}
    </section>
  )
}
