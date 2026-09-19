import type { HistoryPoint } from '../types/upstream'

export const CHART_POINT_BUDGET = 900

/**
 * Min/max bucket downsampling. The 60-day range returns ~28k samples, which
 * is far more than a ~360px-wide chart can show and slow to render on a
 * phone. Splitting into buckets and keeping each bucket's minimum and
 * maximum draws the same envelope with a fraction of the points — and,
 * unlike averaging or every-nth sampling, it cannot flatten a flood peak,
 * which is the one feature of this chart that matters.
 *
 * Returns the input array itself when no reduction is needed, so callers can
 * rely on referential equality for memoisation.
 */
export function downsample(
  points: readonly HistoryPoint[],
  budget: number = CHART_POINT_BUDGET,
): HistoryPoint[] {
  if (budget <= 0 || points.length <= budget) return points as HistoryPoint[]

  // Two points per bucket (the min and the max), minus the endpoints we
  // always keep verbatim.
  const bucketCount = Math.max(1, Math.floor((budget - 2) / 2))
  const bucketSize = points.length / bucketCount

  const out: HistoryPoint[] = [points[0]]

  for (let b = 0; b < bucketCount; b++) {
    const start = Math.floor(b * bucketSize)
    const end = Math.min(points.length, Math.floor((b + 1) * bucketSize))
    if (end <= start) continue

    let lo = points[start]
    let hi = points[start]
    for (let i = start + 1; i < end; i++) {
      const p = points[i]
      if (p.cm < lo.cm) lo = p
      if (p.cm > hi.cm) hi = p
    }

    // Emit in the order they occur so the line stays chronological.
    const first = lo.at.getTime() <= hi.at.getTime() ? lo : hi
    const second = first === lo ? hi : lo
    for (const p of first === second ? [first] : [first, second]) {
      const prev = out[out.length - 1]
      if (p.at.getTime() > prev.at.getTime()) out.push(p)
    }
  }

  const last = points[points.length - 1]
  if (last.at.getTime() > out[out.length - 1].at.getTime()) out.push(last)

  return out
}
