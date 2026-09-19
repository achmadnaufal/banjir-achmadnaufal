import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ANOMALY_FLOOR_CM, peakInWindow } from '../lib/analytics'
import { downsample } from '../lib/downsample'
import { bands } from '../lib/siaga'
import { STATUS_HEX } from '../lib/statusTokens'
import type { ResolvedTheme } from '../hooks/useTheme'
import type { HistoryResponse, ThresholdsCm } from '../types/upstream'

type Props = {
  data: HistoryResponse
  fallbackThresholdsCm: ThresholdsCm
  theme: ResolvedTheme
}

const TIME_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const DAY_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit',
  month: 'short',
})

const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const MULTI_DAY_THRESHOLD_MS = 36 * 60 * 60 * 1000

type ChartTheme = {
  surface: string
  axis: string
  grid: string
  line: string
  tooltipBg: string
  tooltipText: string
  tooltipMuted: string
}

const LIGHT: ChartTheme = {
  surface: '#fcfcfb',
  axis: '#898781',
  grid: '#e3e2dd',
  line: '#0b0b0b',
  tooltipBg: '#0b0b0b',
  tooltipText: '#ffffff',
  tooltipMuted: '#c3c2b7',
}

const DARK: ChartTheme = {
  surface: '#1a1a19',
  axis: '#898781',
  grid: '#2e2e2b',
  line: '#ffffff',
  tooltipBg: '#f9f9f7',
  tooltipText: '#0b0b0b',
  tooltipMuted: '#52514e',
}

export function SiagaChart({ data, fallbackThresholdsCm, theme }: Props) {
  const t = theme === 'dark' ? DARK : LIGHT
  const thresholds = data.thresholdsCm ?? fallbackThresholdsCm

  const { series, droppedAnomalies, peak } = useMemo(() => {
    const clean = data.points.filter((p) => p.cm >= ANOMALY_FLOOR_CM)
    // Peak comes from the full-resolution series so the marker is exact even
    // when the line itself is drawn from a reduced set.
    const peakPoint = peakInWindow(clean)
    return {
      series: downsample(clean).map((p) => ({ t: p.at.getTime(), cm: p.cm })),
      droppedAnomalies: data.points.length - clean.length,
      peak: peakPoint,
    }
  }, [data.points])

  if (series.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-surface text-sm text-ink-3 sm:aspect-[16/9]">
        Belum ada data
      </div>
    )
  }

  const minObserved = Math.min(...series.map((p) => p.cm))
  const maxObserved = Math.max(...series.map((p) => p.cm))
  const spanMs = series[series.length - 1].t - series[0].t
  const isMultiDay = spanMs >= MULTI_DAY_THRESHOLD_MS
  const xTickFormatter = (v: number) =>
    isMultiDay ? DAY_FORMATTER.format(new Date(v)) : TIME_FORMATTER.format(new Date(v))

  // Where the peak sits along the x-axis, so its direct label can dodge the
  // plot edge rather than being cropped by it.
  const firstT = series[0].t
  const lastT = series[series.length - 1].t
  const peakFraction =
    peak === null || lastT === firstT ? 0.5 : (peak.at.getTime() - firstT) / (lastT - firstT)
  const peakNearEnd: 'left' | 'right' | null =
    peakFraction > 0.82 ? 'right' : peakFraction < 0.18 ? 'left' : null

  const yMax = Math.ceil(Math.max(thresholds.siaga1 * 1.05, maxObserved * 1.1) / 10) * 10
  const yMin = Math.max(0, Math.floor((Math.min(minObserved, thresholds.siaga3) - 20) / 10) * 10)

  // Bands share the page's status steps, so the chart and the legend are the
  // same colour language rather than two parallel ones.
  const areas = [
    { y1: yMin, y2: thresholds.siaga3, fill: STATUS_HEX.good },
    { y1: thresholds.siaga3, y2: thresholds.siaga2, fill: STATUS_HEX.warning },
    { y1: thresholds.siaga2, y2: thresholds.siaga1, fill: STATUS_HEX.serious },
    { y1: thresholds.siaga1, y2: yMax, fill: STATUS_HEX.critical },
  ]

  const lines = bands(thresholds)
    .filter((b) => b.level !== 'normal')
    .map((b) => ({
      y: b.level === 'siaga1' ? thresholds.siaga1 : b.level === 'siaga2' ? thresholds.siaga2 : thresholds.siaga3,
      label: b.label.toLowerCase(),
      stroke: b.level === 'siaga1' ? STATUS_HEX.critical : b.level === 'siaga2' ? STATUS_HEX.serious : STATUS_HEX.warning,
    }))

  return (
    <figure className="m-0 rounded-xl bg-surface p-2 pt-3">
      <div className="aspect-[4/3] w-full sm:aspect-[16/9]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 14, right: 12, bottom: 4, left: 0 }}>
            {/* Solid hairlines: a dashed grid reads as "threshold" when it is
                only a grid. The dashes below are real thresholds. */}
            <CartesianGrid stroke={t.grid} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
              tickFormatter={xTickFormatter}
              stroke={t.grid}
              tick={{ fill: t.axis, fontSize: 11 }}
              tickLine={false}
              minTickGap={36}
            />
            <YAxis
              domain={[yMin, yMax]}
              stroke={t.grid}
              tick={{ fill: t.axis, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={34}
            />

            {areas.map((a) => (
              <ReferenceArea key={a.fill} y1={a.y1} y2={a.y2} fill={a.fill} fillOpacity={0.1} />
            ))}

            {lines.map((l) => (
              <ReferenceLine
                key={l.label}
                y={l.y}
                stroke={l.stroke}
                strokeDasharray="5 4"
                strokeOpacity={0.9}
                label={{
                  value: l.label,
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: t.axis,
                  dy: -2,
                }}
              />
            ))}

            <Tooltip
              cursor={{ stroke: t.axis, strokeWidth: 1 }}
              contentStyle={{
                background: t.tooltipBg,
                border: 'none',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 12,
              }}
              labelStyle={{ color: t.tooltipMuted, fontSize: 11, marginBottom: 2 }}
              itemStyle={{ color: t.tooltipText, fontSize: 14, fontWeight: 600 }}
              labelFormatter={(label) => DATE_FORMATTER.format(new Date(Number(label)))}
              formatter={(value) => [`${Math.round(Number(value))} cm`, ''] as [string, string]}
            />

            <Line
              type="monotone"
              dataKey="cm"
              stroke={t.line}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />

            {peak && (
              <ReferenceDot
                x={peak.at.getTime()}
                y={peak.cm}
                r={4}
                fill={t.line}
                stroke={t.surface}
                strokeWidth={2}
                ifOverflow="extendDomain"
                label={{
                  value: `puncak ${Math.round(peak.cm)}`,
                  // A peak near either end would have its label clipped by the
                  // plot edge, so anchor it inward on the crowded side.
                  position: peakNearEnd === 'right' ? 'left' : peakNearEnd === 'left' ? 'right' : 'top',
                  fontSize: 10,
                  fill: t.axis,
                  offset: 8,
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {droppedAnomalies > 0 && (
        <figcaption className="px-2 pt-1 pb-1 text-[11px] text-ink-3">
          {droppedAnomalies} bacaan anomali (negatif) disembunyikan.
        </figcaption>
      )}
    </figure>
  )
}
