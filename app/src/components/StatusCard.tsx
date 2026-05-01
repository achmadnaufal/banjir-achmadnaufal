import { formatLevel, formatStamp, timeSince, trendArrow } from '../lib/format'
import { classify, trend, type Trend } from '../lib/siaga'
import type { HistoryResponse, SnapshotRow } from '../types/upstream'
import { SiagaBadge } from './SiagaBadge'
import { StatsCard } from './StatsCard'

type Props = {
  snapshot: SnapshotRow
  isStale: boolean
  now: Date
  stats?: HistoryResponse | null
}

const TREND_CLASS: Record<Trend, string> = {
  up: 'text-red-600 dark:text-red-400',
  down: 'text-emerald-600 dark:text-emerald-400',
  flat: 'text-zinc-500 dark:text-zinc-400',
}

const TREND_LABEL: Record<Trend, string> = {
  up: 'rising',
  down: 'falling',
  flat: 'flat',
}

export function StatusCard({ snapshot, isStale, now, stats }: Props) {
  const level = classify(snapshot.levelCm, snapshot.thresholdsCm)
  const direction = trend(snapshot.prevLevelCm, snapshot.levelCm)
  const arrow = trendArrow(direction)
  const delta =
    snapshot.prevLevelCm === null
      ? null
      : Math.round((snapshot.levelCm - snapshot.prevLevelCm) * 10) / 10

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900" aria-label="Current status">
      <div className="mb-3 flex items-center gap-3">
        <SiagaBadge level={level} />
        {isStale && (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            stale data
          </span>
        )}
      </div>
      <p className="text-6xl font-bold tabular-nums">{formatLevel(snapshot.levelCm)}</p>
      <p className="mt-2 text-sm">
        <span
          aria-label={`Trend ${TREND_LABEL[direction]}`}
          className={`mr-1 inline-block font-semibold ${TREND_CLASS[direction]}`}
        >
          {arrow}
        </span>
        {delta === null ? (
          <span className="text-zinc-500 dark:text-zinc-400">no previous reading</span>
        ) : (
          <span className={TREND_CLASS[direction]}>
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)} cm vs prev
          </span>
        )}
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        observed {formatStamp(snapshot.observedAt)} · {timeSince(snapshot.observedAt, now)}
      </p>
      {stats && (
        <>
          <div className="my-4 border-t border-zinc-100 dark:border-zinc-800" />
          <StatsCard history={stats} snapshot={snapshot} now={now} />
        </>
      )}
    </section>
  )
}
