import { useMemo } from 'react'
import {
  bandTenure,
  dropAnomalies,
  etaToNextBand,
  peakInWindow,
  VELOCITY_WINDOW_MS,
  velocityCmPerHour,
} from '../lib/analytics'
import { formatDuration, timeSince } from '../lib/format'
import { siagaMeta, type Trend } from '../lib/siaga'
import type { HistoryResponse, SnapshotRow } from '../types/upstream'

type Props = {
  history: HistoryResponse
  snapshot: SnapshotRow
  now: Date
}

const ARROW_CLASS: Record<Trend, string> = {
  up: 'text-critical',
  down: 'text-good',
  flat: 'text-ink-3',
}

function rateTrend(rate: number | null): Trend {
  if (rate === null) return 'flat'
  if (rate > 0.5) return 'up'
  if (rate < -0.5) return 'down'
  return 'flat'
}

/** A KPI tile: quiet letterspaced field name over a value that carries the weight. */
function Tile({
  label,
  value,
  meta,
}: {
  label: string
  value: React.ReactNode
  meta?: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="label">{label}</p>
      <p className="mt-1 truncate text-[17px] leading-tight font-semibold">{value}</p>
      {meta && <p className="mt-0.5 truncate text-[11px] text-ink-3">{meta}</p>}
    </div>
  )
}

export function StatsRow({ history, snapshot, now }: Props) {
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
    return <p className="text-sm text-ink-3">Mengumpulkan tren 24 jam…</p>
  }

  const vTrend = rateTrend(velocity)
  const peakDelta = peak === null ? null : Math.round(peak.cm - snapshot.levelCm)

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4" aria-label="Ringkasan 24 jam">
      <Tile
        label="Puncak 24 jam"
        value={peak === null ? '—' : `${Math.round(peak.cm)} cm`}
        meta={
          peak === null
            ? undefined
            : peakDelta === null || peakDelta === 0
              ? timeSince(peak.at, now)
              : `${timeSince(peak.at, now)} · ${peakDelta > 0 ? `${peakDelta} cm di atas kini` : `${Math.abs(peakDelta)} cm di bawah kini`}`
        }
      />

      <Tile
        label="Laju 60 menit"
        value={
          velocity === null ? (
            '—'
          ) : (
            <>
              <span aria-hidden="true" className={`mr-1 ${ARROW_CLASS[vTrend]}`}>
                {vTrend === 'up' ? '▲' : vTrend === 'down' ? '▼' : '■'}
              </span>
              {velocity > 0 ? '+' : ''}
              {velocity.toFixed(1)} cm/j
            </>
          )
        }
      />

      <Tile
        label={`Di ${siagaMeta(tenure.level).label}`}
        value={`${tenure.isWindowFloor ? '≥ ' : ''}${formatDuration(tenure.sinceMs)}`}
      />

      <Tile
        label={eta === null ? 'Perkiraan' : eta.direction === 'rising' ? 'Perkiraan naik' : 'Perkiraan turun'}
        value={
          eta === null ? (
            <span className="text-ink-3">stabil</span>
          ) : (
            <>
              <span
                aria-hidden="true"
                className={`mr-1 ${eta.direction === 'rising' ? 'text-critical' : 'text-good'}`}
              >
                {eta.direction === 'rising' ? '↗' : '↘'}
              </span>
              {formatDuration(eta.etaMs)}
            </>
          )
        }
        meta={
          eta === null ? 'tak ada perubahan band' : `ke ${siagaMeta(eta.targetLevel).label} · laju kini`
        }
      />
    </div>
  )
}
