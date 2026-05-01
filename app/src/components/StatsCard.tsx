import { useMemo } from 'react'
import {
  bandTenure,
  dropAnomalies,
  etaToNextBand,
  peakInWindow,
  VELOCITY_WINDOW_MS,
  velocityCmPerHour,
} from '../lib/analytics'
import { formatDuration, formatStamp, timeSince } from '../lib/format'
import { siagaMeta, type Trend } from '../lib/siaga'
import type { Range } from '../hooks/useHistory'
import type { HistoryResponse, SnapshotRow } from '../types/upstream'

type Props = {
  history: HistoryResponse
  snapshot: SnapshotRow
  range: Range
  now: Date
}

const TREND_CLASS: Record<Trend, string> = {
  up: 'text-red-600 dark:text-red-400',
  down: 'text-emerald-600 dark:text-emerald-400',
  flat: 'text-zinc-500 dark:text-zinc-400',
}

const RANGE_LABEL: Record<Range, string> = {
  '6h': 'Last 6h',
  '12h': 'Last 12h',
  '24h': 'Last 24h',
  '7d': 'Last 7d',
}

function trendOfRate(rate: number | null): Trend {
  if (rate === null) return 'flat'
  if (rate > 0.5) return 'up'
  if (rate < -0.5) return 'down'
  return 'flat'
}

function Row({
  label,
  children,
  valueClass,
}: {
  label: string
  children: React.ReactNode
  valueClass?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={`text-right tabular-nums ${valueClass ?? ''}`}>{children}</span>
    </div>
  )
}

export function StatsCard({ history, snapshot, range, now }: Props) {
  const cleanPoints = useMemo(() => dropAnomalies(history.points), [history.points])
  const thresholds = history.thresholdsCm ?? snapshot.thresholdsCm
  const peak = useMemo(() => peakInWindow(cleanPoints), [cleanPoints])
  const velocity = useMemo(
    () => velocityCmPerHour(cleanPoints, now, VELOCITY_WINDOW_MS),
    [cleanPoints, now],
  )
  const tenure = useMemo(
    () => bandTenure(cleanPoints, thresholds, snapshot.levelCm),
    [cleanPoints, thresholds, snapshot.levelCm],
  )
  const eta = useMemo(() => {
    if (range === '7d') return null
    if (velocity === null) return null
    return etaToNextBand(snapshot.levelCm, velocity, thresholds)
  }, [range, velocity, snapshot.levelCm, thresholds])

  if (cleanPoints.length < 2) {
    return (
      <section className="rounded-2xl bg-white p-4 text-sm text-zinc-500 shadow-sm dark:bg-zinc-900 dark:text-zinc-400">
        Gathering trend…
      </section>
    )
  }

  const velocityTrend = trendOfRate(velocity)
  const peakDelta = peak === null ? null : Math.round((peak.cm - snapshot.levelCm) * 10) / 10

  return (
    <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900" aria-label="Recent trend stats">
      <h2 className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {RANGE_LABEL[range]}
      </h2>

      {peak ? (
        <Row label="Peak">
          <span>{Math.round(peak.cm)} cm</span>
          <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
            {formatStamp(peak.at)} · {timeSince(peak.at, now)}
          </span>
          {peakDelta !== null && peakDelta > 0 && (
            <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
              now {Math.round(peakDelta)} cm below
            </span>
          )}
          {peakDelta !== null && peakDelta < 0 && (
            <span className="ml-2 text-xs text-red-600 dark:text-red-400">
              now {Math.abs(Math.round(peakDelta))} cm above
            </span>
          )}
        </Row>
      ) : (
        <Row label="Peak">—</Row>
      )}

      <Row label="Velocity (last 60m)" valueClass={TREND_CLASS[velocityTrend]}>
        {velocity === null ? (
          <span className="text-zinc-500 dark:text-zinc-400">—</span>
        ) : (
          <>
            {velocity > 0 ? '+' : ''}
            {velocity.toFixed(1)} cm/h
          </>
        )}
      </Row>

      <Row label={`In ${siagaMeta(tenure.level).label}`}>
        {tenure.isWindowFloor ? '≥ ' : ''}
        {formatDuration(tenure.sinceMs)}
      </Row>

      {eta && (
        <Row
          label={eta.direction === 'rising' ? 'ETA next band' : 'ETA recovery'}
          valueClass={eta.direction === 'rising' ? TREND_CLASS.up : TREND_CLASS.down}
        >
          {eta.direction === 'rising' ? '↗ ' : '↘ '}
          {siagaMeta(eta.targetLevel).label} in ~{formatDuration(eta.etaMs)}
          <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
            at current rate
          </span>
        </Row>
      )}
    </section>
  )
}
