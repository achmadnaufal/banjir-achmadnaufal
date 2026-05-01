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
import type { HistoryResponse, SnapshotRow } from '../types/upstream'

type Props = {
  history: HistoryResponse
  snapshot: SnapshotRow
  now: Date
}

const TREND_CLASS: Record<Trend, string> = {
  up: 'text-red-600 dark:text-red-400',
  down: 'text-emerald-600 dark:text-emerald-400',
  flat: 'text-zinc-500 dark:text-zinc-400',
}

function trendOfRate(rate: number | null): Trend {
  if (rate === null) return 'flat'
  if (rate > 0.5) return 'up'
  if (rate < -0.5) return 'down'
  return 'flat'
}

function Row({
  label,
  value,
  meta,
  valueClass,
}: {
  label: string
  value: React.ReactNode
  meta?: React.ReactNode
  valueClass?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="min-w-0 text-right">
        <span className={`tabular-nums ${valueClass ?? ''}`}>{value}</span>
        {meta && (
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">{meta}</span>
        )}
      </span>
    </div>
  )
}

export function StatsCard({ history, snapshot, now }: Props) {
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
  const eta = useMemo(
    () => etaToNextBand(snapshot.levelCm, cleanPoints, now, thresholds),
    [snapshot.levelCm, cleanPoints, now, thresholds],
  )

  if (cleanPoints.length < 2) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Gathering 24-hour trend…</p>
    )
  }

  const velocityTrend = trendOfRate(velocity)
  const peakDelta = peak === null ? null : Math.round((peak.cm - snapshot.levelCm) * 10) / 10
  const peakBelow = peakDelta !== null && peakDelta > 0
  const peakAbove = peakDelta !== null && peakDelta < 0

  return (
    <div className="space-y-2.5" aria-label="Last 24 hours summary">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Last 24 hours
      </p>

      {peak ? (
        <Row
          label="Peak"
          value={`${Math.round(peak.cm)} cm`}
          meta={
            <>
              <span className="block">
                {formatStamp(peak.at)} · {timeSince(peak.at, now)}
              </span>
              {peakBelow && (
                <span className="block text-emerald-600 dark:text-emerald-400">
                  now {Math.round(peakDelta)} cm below
                </span>
              )}
              {peakAbove && (
                <span className="block text-red-600 dark:text-red-400">
                  now {Math.abs(Math.round(peakDelta))} cm above
                </span>
              )}
            </>
          }
        />
      ) : (
        <Row label="Peak" value="—" />
      )}

      <Row
        label="Velocity (60m)"
        valueClass={TREND_CLASS[velocityTrend]}
        value={
          velocity === null ? (
            <span className="text-zinc-500 dark:text-zinc-400">—</span>
          ) : (
            <>
              {velocity > 0 ? '+' : ''}
              {velocity.toFixed(1)} cm/h
            </>
          )
        }
      />

      <Row
        label={`In ${siagaMeta(tenure.level).label}`}
        value={
          <>
            {tenure.isWindowFloor ? '≥ ' : ''}
            {formatDuration(tenure.sinceMs)}
          </>
        }
      />

      {eta && (
        <Row
          label={eta.direction === 'rising' ? 'ETA next band' : 'ETA recovery'}
          valueClass={eta.direction === 'rising' ? TREND_CLASS.up : TREND_CLASS.down}
          value={
            <>
              {eta.direction === 'rising' ? '↗ ' : '↘ '}
              {siagaMeta(eta.targetLevel).label} in ~{formatDuration(eta.etaMs)}
            </>
          }
          meta={<span>at current rate</span>}
        />
      )}
    </div>
  )
}
