import { useMemo } from 'react'
import {
  bandTenure,
  dropAnomalies,
  etaToNextBand,
  peakInWindow,
  velocityCmPerHour,
} from '../lib/analytics'
import { useI18n } from '../i18n/useI18n'
import { formatDuration, timeSince } from '../lib/format'
import {
  analysisAnchor,
  etaFromNow,
  rateWindowMs,
  type ReadingSource,
} from '../lib/manualFallback'
import { siagaMeta, type Trend } from '../lib/siaga'
import type { HistoryResponse, SnapshotRow } from '../types/upstream'

type Props = {
  history: HistoryResponse
  snapshot: SnapshotRow
  now: Date
  source: ReadingSource
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
      {meta && <p className="mt-0.5 text-[11px] leading-snug text-ink-3">{meta}</p>}
    </div>
  )
}

export function StatsRow({ history, snapshot, now, source }: Props) {
  const { t, tag } = useI18n()
  const cleanPoints = useMemo(() => dropAnomalies(history.points), [history.points])
  const thresholds = history.thresholdsCm ?? snapshot.thresholdsCm
  const peak = useMemo(() => peakInWindow(cleanPoints), [cleanPoints])
  const windowMs = rateWindowMs(source)
  const anchor = analysisAnchor(source, snapshot.observedAt, now)
  const velocity = useMemo(
    () => velocityCmPerHour(cleanPoints, anchor, windowMs),
    [cleanPoints, anchor, windowMs],
  )
  const tenure = useMemo(
    () => bandTenure(cleanPoints, thresholds, snapshot.levelCm),
    [cleanPoints, thresholds, snapshot.levelCm],
  )
  const eta = useMemo(
    () =>
      etaFromNow(
        // The sensor keeps etaToNextBand's own default window; only the hourly
        // table needs the wider one.
        etaToNextBand(
          snapshot.levelCm,
          cleanPoints,
          anchor,
          thresholds,
          source === 'manual' ? { windowMs } : {},
        ),
        anchor,
        now,
      ),
    [snapshot.levelCm, cleanPoints, anchor, now, thresholds, source, windowMs],
  )

  if (cleanPoints.length < 2) {
    return <p className="text-sm text-ink-3">{t.gathering}</p>
  }

  const vTrend = rateTrend(velocity)
  const peakDelta = peak === null ? null : Math.round(peak.cm - snapshot.levelCm)

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4" aria-label={t.statsRegion}>
      <Tile
        label={t.peak24h}
        value={peak === null ? '—' : `${Math.round(peak.cm)} cm`}
        meta={
          peak === null
            ? undefined
            : peakDelta === null || peakDelta === 0
              ? timeSince(peak.at, now, tag, t.justNow)
              : `${timeSince(peak.at, now, tag, t.justNow)} · ${peakDelta > 0 ? t.cmAboveNow(peakDelta) : t.cmBelowNow(Math.abs(peakDelta))}`
        }
      />

      <Tile
        label={source === 'manual' ? t.rate2h : t.rate60m}
        value={
          velocity === null ? (
            '—'
          ) : (
            <>
              <span aria-hidden="true" className={`mr-1 ${ARROW_CLASS[vTrend]}`}>
                {vTrend === 'up' ? '▲' : vTrend === 'down' ? '▼' : '■'}
              </span>
              {velocity > 0 ? '+' : ''}
              {velocity.toFixed(1)} {t.rateUnit}
            </>
          )
        }
      />

      <Tile
        label={t.inBand(siagaMeta(tenure.level).label)}
        value={`${tenure.isWindowFloor ? '≥ ' : ''}${formatDuration(tenure.sinceMs, t)}`}
      />

      <Tile
        label={eta === null ? t.forecast : eta.direction === 'rising' ? t.etaRising : t.etaFalling}
        value={
          eta === null ? (
            <span className="text-ink-3">{t.steady}</span>
          ) : (
            <>
              <span
                aria-hidden="true"
                className={`mr-1 ${eta.direction === 'rising' ? 'text-critical' : 'text-good'}`}
              >
                {eta.direction === 'rising' ? '↗' : '↘'}
              </span>
              {formatDuration(eta.etaMs, t)}
            </>
          )
        }
        meta={
          eta === null ? t.noBandChange : t.etaTo(siagaMeta(eta.targetLevel).label)
        }
      />
    </div>
  )
}
