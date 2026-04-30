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

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function SiagaChart({ data, fallbackThresholdsCm }: Props) {
  const thresholds = data.thresholdsCm ?? fallbackThresholdsCm
  const series = useMemo(
    () => data.points.map((p) => ({ t: p.at.getTime(), cm: p.cm })),
    [data.points],
  )

  if (series.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-white text-sm text-zinc-500 shadow-sm sm:aspect-[16/9] dark:bg-zinc-900 dark:text-zinc-400">
        No data available
      </div>
    )
  }

  const maxObserved = Math.max(...series.map((p) => p.cm))
  const yMax = Math.ceil(Math.max(thresholds.siaga1 * 1.1, maxObserved * 1.15) / 50) * 50

  return (
    <div className="aspect-[4/3] w-full rounded-2xl bg-white p-2 shadow-sm sm:aspect-[16/9] dark:bg-zinc-900">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 16, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" strokeOpacity={0.4} />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={(v: number) => TIME_FORMATTER.format(new Date(v))}
            stroke="#a1a1aa"
            fontSize={11}
            minTickGap={32}
          />
          <YAxis
            domain={[0, yMax]}
            stroke="#a1a1aa"
            fontSize={11}
            tickFormatter={(v) => `${v}`}
            label={{ value: 'cm', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#a1a1aa' }}
          />
          <ReferenceArea y1={0} y2={thresholds.siaga3} fill="#10b981" fillOpacity={0.12} />
          <ReferenceArea y1={thresholds.siaga3} y2={thresholds.siaga2} fill="#fde047" fillOpacity={0.18} />
          <ReferenceArea y1={thresholds.siaga2} y2={thresholds.siaga1} fill="#fb923c" fillOpacity={0.18} />
          <ReferenceArea y1={thresholds.siaga1} y2={yMax} fill="#ef4444" fillOpacity={0.18} />
          <ReferenceLine y={thresholds.siaga3} stroke="#ca8a04" strokeDasharray="4 4" label={{ value: 'siaga 3', position: 'right', fontSize: 10, fill: '#ca8a04' }} />
          <ReferenceLine y={thresholds.siaga2} stroke="#ea580c" strokeDasharray="4 4" label={{ value: 'siaga 2', position: 'right', fontSize: 10, fill: '#ea580c' }} />
          <ReferenceLine y={thresholds.siaga1} stroke="#dc2626" strokeDasharray="4 4" label={{ value: 'siaga 1', position: 'right', fontSize: 10, fill: '#dc2626' }} />
          <Tooltip
            contentStyle={{ background: 'rgba(24,24,27,0.92)', border: 'none', color: '#fafafa', fontSize: 12 }}
            labelFormatter={(label) => DATE_FORMATTER.format(new Date(Number(label)))}
            formatter={(value) => [`${Number(value)} cm`, 'Level'] as [string, string]}
          />
          <Line type="monotone" dataKey="cm" stroke="#0f172a" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
