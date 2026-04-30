import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { usePrefersDark } from '../hooks/usePrefersDark'
import type { HistoryResponse, ThresholdsCm } from '../types/upstream'

type Props = {
  data: HistoryResponse
  fallbackThresholdsCm: ThresholdsCm
}

const TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const DAY_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit',
  month: 'short',
})

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

// Pesanggrahan sensor occasionally returns large negative values when the
// gauge is offline or being recalibrated (e.g. -515 cm). Anything below
// this floor is treated as a sensor anomaly and excluded from the chart.
const ANOMALY_FLOOR_CM = -10
const MULTI_DAY_THRESHOLD_MS = 36 * 60 * 60 * 1000

type Theme = {
  axis: string
  grid: string
  line: string
  tooltipBg: string
  tooltipText: string
  bandSiaga3: string
  bandSiaga2: string
  bandSiaga1: string
  bandNormal: string
  lineSiaga3: string
  lineSiaga2: string
  lineSiaga1: string
}

const LIGHT: Theme = {
  axis: '#71717a',
  grid: '#e4e4e7',
  line: '#0f172a',
  tooltipBg: 'rgba(24,24,27,0.92)',
  tooltipText: '#fafafa',
  bandNormal: '#10b981',
  bandSiaga3: '#fde047',
  bandSiaga2: '#fb923c',
  bandSiaga1: '#ef4444',
  lineSiaga3: '#ca8a04',
  lineSiaga2: '#ea580c',
  lineSiaga1: '#dc2626',
}

const DARK: Theme = {
  axis: '#a1a1aa',
  grid: '#3f3f46',
  line: '#e2e8f0',
  tooltipBg: 'rgba(244,244,245,0.95)',
  tooltipText: '#18181b',
  bandNormal: '#34d399',
  bandSiaga3: '#facc15',
  bandSiaga2: '#fb923c',
  bandSiaga1: '#f87171',
  lineSiaga3: '#facc15',
  lineSiaga2: '#fb923c',
  lineSiaga1: '#f87171',
}

export function SiagaChart({ data, fallbackThresholdsCm }: Props) {
  const dark = usePrefersDark()
  const t = dark ? DARK : LIGHT
  const thresholds = data.thresholdsCm ?? fallbackThresholdsCm

  const { series, droppedAnomalies } = useMemo(() => {
    const raw = data.points.map((p) => ({ t: p.at.getTime(), cm: p.cm }))
    const filtered = raw.filter((p) => p.cm >= ANOMALY_FLOOR_CM)
    return { series: filtered, droppedAnomalies: raw.length - filtered.length }
  }, [data.points])

  if (series.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-white text-sm text-zinc-500 shadow-sm sm:aspect-[16/9] dark:bg-zinc-900 dark:text-zinc-400">
        No data available
      </div>
    )
  }

  const minObserved = Math.min(...series.map((p) => p.cm))
  const maxObserved = Math.max(...series.map((p) => p.cm))
  const spanMs = series[series.length - 1].t - series[0].t
  const isMultiDay = spanMs >= MULTI_DAY_THRESHOLD_MS
  const xTickFormatter = (v: number) => {
    const d = new Date(v)
    return isMultiDay ? DAY_FORMATTER.format(d) : TIME_FORMATTER.format(d)
  }

  const yMax = Math.ceil(Math.max(thresholds.siaga1 * 1.05, maxObserved * 1.1) / 10) * 10
  const yMinFloor = Math.min(minObserved, thresholds.siaga3)
  const yMin = Math.max(0, Math.floor((yMinFloor - 20) / 10) * 10)

  return (
    <div className="aspect-[4/3] w-full rounded-2xl bg-white p-2 shadow-sm sm:aspect-[16/9] dark:bg-zinc-900">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.grid} strokeOpacity={0.5} />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={xTickFormatter}
            stroke={t.axis}
            tick={{ fill: t.axis, fontSize: 11 }}
            minTickGap={32}
          />
          <YAxis
            domain={[yMin, yMax]}
            stroke={t.axis}
            tick={{ fill: t.axis, fontSize: 11 }}
            tickFormatter={(v) => `${v}`}
            label={{ value: 'cm', angle: -90, position: 'insideLeft', fontSize: 11, fill: t.axis }}
          />
          <ReferenceArea y1={yMin} y2={thresholds.siaga3} fill={t.bandNormal} fillOpacity={0.12} />
          <ReferenceArea y1={thresholds.siaga3} y2={thresholds.siaga2} fill={t.bandSiaga3} fillOpacity={0.18} />
          <ReferenceArea y1={thresholds.siaga2} y2={thresholds.siaga1} fill={t.bandSiaga2} fillOpacity={0.18} />
          <ReferenceArea y1={thresholds.siaga1} y2={yMax} fill={t.bandSiaga1} fillOpacity={0.18} />
          <ReferenceLine y={thresholds.siaga3} stroke={t.lineSiaga3} strokeDasharray="4 4" label={{ value: 'siaga 3', position: 'right', fontSize: 10, fill: t.lineSiaga3 }} />
          <ReferenceLine y={thresholds.siaga2} stroke={t.lineSiaga2} strokeDasharray="4 4" label={{ value: 'siaga 2', position: 'right', fontSize: 10, fill: t.lineSiaga2 }} />
          <ReferenceLine y={thresholds.siaga1} stroke={t.lineSiaga1} strokeDasharray="4 4" label={{ value: 'siaga 1', position: 'right', fontSize: 10, fill: t.lineSiaga1 }} />
          <Tooltip
            contentStyle={{ background: t.tooltipBg, border: 'none', color: t.tooltipText, fontSize: 12, borderRadius: 8 }}
            labelStyle={{ color: t.tooltipText }}
            itemStyle={{ color: t.tooltipText }}
            labelFormatter={(label) => DATE_FORMATTER.format(new Date(Number(label)))}
            formatter={(value) => [`${Number(value)} cm`, 'Level'] as [string, string]}
          />
          <Line type="monotone" dataKey="cm" stroke={t.line} strokeWidth={1.75} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      {droppedAnomalies > 0 && (
        <p className="px-3 pb-2 text-[11px] text-zinc-500 dark:text-zinc-400">
          Hid {droppedAnomalies} sensor-anomaly point{droppedAnomalies === 1 ? '' : 's'} (negative readings).
        </p>
      )}
    </div>
  )
}
