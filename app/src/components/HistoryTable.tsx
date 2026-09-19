import { useMemo } from 'react'
import { ANOMALY_FLOOR_CM } from '../lib/analytics'
import { downsample } from '../lib/downsample'
import { classify, siagaMeta } from '../lib/siaga'
import { statusToken } from '../lib/statusTokens'
import type { HistoryResponse, ThresholdsCm } from '../types/upstream'

type Props = {
  data: HistoryResponse
  fallbackThresholdsCm: ThresholdsCm
}

const ROW_BUDGET = 60

const STAMP = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/**
 * The chart's table-view twin. A tooltip must never be the only way to read a
 * value, and a colour-coded band must never be the only way to read status —
 * this is the WCAG-clean equivalent of the same data.
 */
export function HistoryTable({ data, fallbackThresholdsCm }: Props) {
  const thresholds = data.thresholdsCm ?? fallbackThresholdsCm
  const rows = useMemo(() => {
    const clean = data.points.filter((p) => p.cm >= ANOMALY_FLOOR_CM)
    return downsample(clean, ROW_BUDGET).slice().reverse()
  }, [data.points])

  if (rows.length === 0) return null

  return (
    <details className="group rounded-xl bg-surface">
      <summary className="label flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 hover:text-ink-2">
        <span aria-hidden="true" className="transition-transform group-open:rotate-90">
          ▸
        </span>
        Lihat sebagai tabel
      </summary>
      <div className="max-h-80 overflow-y-auto border-t border-hairline">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Tinggi muka air Sungai Pesanggrahan, terbaru lebih dulu
          </caption>
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-hairline text-left">
              <th scope="col" className="label px-4 py-2 font-semibold">Waktu</th>
              <th scope="col" className="label px-4 py-2 text-right font-semibold">Tinggi</th>
              <th scope="col" className="label px-4 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const level = classify(p.cm, thresholds)
              return (
                <tr key={p.at.getTime()} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-1.5 text-ink-2 tabular-nums">{STAMP.format(p.at)}</td>
                  <td className="px-4 py-1.5 text-right font-medium tabular-nums">
                    {Math.round(p.cm)} cm
                  </td>
                  <td className="px-4 py-1.5">
                    <span className="inline-flex items-center gap-1.5 text-ink-2">
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: statusToken(level).hex }}
                      />
                      {siagaMeta(level).label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
