import { formatLevel, formatStamp, timeSince, trendArrow } from '../lib/format'
import { classify, trend } from '../lib/siaga'
import type { SnapshotRow } from '../types/upstream'
import { SiagaBadge } from './SiagaBadge'

type Props = {
  snapshot: SnapshotRow
  isStale: boolean
  now: Date
}

export function StatusCard({ snapshot, isStale, now }: Props) {
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
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        <span aria-hidden className="mr-1 inline-block">{arrow}</span>
        {delta === null ? (
          <span>no previous reading</span>
        ) : (
          <span>
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)} cm vs prev
          </span>
        )}
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        observed {formatStamp(snapshot.observedAt)} · {timeSince(snapshot.observedAt, now)}
      </p>
    </section>
  )
}
