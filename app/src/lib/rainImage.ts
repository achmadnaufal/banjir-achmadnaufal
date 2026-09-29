import { rainColor } from './rainColor'

/**
 * Blend two hourly frames. `t` = 0 is `a`, 1 is `b`. Where one side is
 * missing the other is used as-is, so a gap never blinks the map out.
 */
export function lerpFrames(a: readonly number[], b: readonly number[], t: number): number[] {
  if (a.length !== b.length) {
    throw new RangeError(`Cannot blend frames of ${a.length} and ${b.length} cells`)
  }
  return a.map((va, i) => {
    const vb = b[i]
    if (!Number.isFinite(va)) return vb
    if (!Number.isFinite(vb)) return va
    return va + (vb - va) * t
  })
}

function sampleAxis(outIndex: number, outSize: number, cells: number) {
  // Source cell centres sit at 0..cells-1; pixels beyond the outer centres clamp.
  const s = Math.min(Math.max(((outIndex + 0.5) * cells) / outSize - 0.5, 0), cells - 1)
  const i0 = Math.floor(s)
  return { i0, i1: Math.min(i0 + 1, cells - 1), f: s - i0 }
}

/**
 * Bilinear upsample of a rows × cols value grid to width × height. Values are
 * interpolated *before* colouring, so a blue cell next to a yellow one passes
 * through purple the way real rain intensity would — blending colours instead
 * gives a muddy grey. Missing corners are dropped from the weighting.
 */
export function upsample(
  mm: readonly number[],
  rows: number,
  cols: number,
  width: number,
  height: number,
): number[] {
  if (mm.length !== rows * cols) {
    throw new RangeError(`Frame has ${mm.length} cells, grid expects ${rows * cols}`)
  }
  const xs = Array.from({ length: width }, (_, x) => sampleAxis(x, width, cols))
  const ys = Array.from({ length: height }, (_, y) => sampleAxis(y, height, rows))

  return ys.flatMap((sy) =>
    xs.map((sx) => {
      const corners = [
        { v: mm[sy.i0 * cols + sx.i0], w: (1 - sx.f) * (1 - sy.f) },
        { v: mm[sy.i0 * cols + sx.i1], w: sx.f * (1 - sy.f) },
        { v: mm[sy.i1 * cols + sx.i0], w: (1 - sx.f) * sy.f },
        { v: mm[sy.i1 * cols + sx.i1], w: sx.f * sy.f },
      ].filter((c) => Number.isFinite(c.v))
      if (corners.length === 0) return Number.NaN
      const weight = corners.reduce((sum, c) => sum + c.w, 0)
      if (weight === 0) return corners.reduce((sum, c) => sum + c.v, 0) / corners.length
      return corners.reduce((sum, c) => sum + c.v * c.w, 0) / weight
    }),
  )
}

/** RGBA pixels for already-upsampled values; dry or missing stays transparent. */
export function colorize(values: readonly number[]): Uint8ClampedArray<ArrayBuffer> {
  const pixels = new Uint8ClampedArray(values.length * 4)
  values.forEach((value, i) => {
    const rgba = rainColor(value)
    if (rgba) pixels.set(rgba, i * 4)
  })
  return pixels
}

/** RGBA pixels for one frame, upsampled to width × height. */
export function renderRainPixels(
  mm: readonly number[],
  rows: number,
  cols: number,
  width: number,
  height: number,
): Uint8ClampedArray<ArrayBuffer> {
  return colorize(upsample(mm, rows, cols, width, height))
}
