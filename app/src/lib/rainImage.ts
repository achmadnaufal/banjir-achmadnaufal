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

function axis(s: number, cells: number) {
  // Cell centres sit at 0..cells-1; anything beyond the outer centres clamps.
  const clamped = Math.min(Math.max(s, 0), cells - 1)
  const i0 = Math.floor(clamped)
  return { i0, i1: Math.min(i0 + 1, cells - 1), f: clamped - i0 }
}

/**
 * Bilinear value at fractional cell coordinates (row, col), where integer
 * coordinates are cell centres. Missing corners are dropped from the
 * weighting so one gap never spreads NaN across its neighbours.
 */
export function bilinear(mm: readonly number[], rows: number, cols: number, row: number, col: number): number {
  // Hot path (hundreds of thousands of calls per forecast), so no allocations.
  const y = axis(row, rows)
  const x = axis(col, cols)
  const v00 = mm[y.i0 * cols + x.i0]
  const v01 = mm[y.i0 * cols + x.i1]
  const v10 = mm[y.i1 * cols + x.i0]
  const v11 = mm[y.i1 * cols + x.i1]
  const w00 = (1 - x.f) * (1 - y.f)
  const w01 = x.f * (1 - y.f)
  const w10 = (1 - x.f) * y.f
  const w11 = x.f * y.f

  let weight = 0
  let sum = 0
  let count = 0
  let plain = 0
  if (Number.isFinite(v00)) { weight += w00; sum += v00 * w00; count++; plain += v00 }
  if (Number.isFinite(v01)) { weight += w01; sum += v01 * w01; count++; plain += v01 }
  if (Number.isFinite(v10)) { weight += w10; sum += v10 * w10; count++; plain += v10 }
  if (Number.isFinite(v11)) { weight += w11; sum += v11 * w11; count++; plain += v11 }
  if (count === 0) return Number.NaN
  return weight === 0 ? plain / count : sum / weight
}

/**
 * Bilinear upsample of a rows × cols value grid to width × height. Values are
 * interpolated *before* colouring, so a blue cell next to a yellow one passes
 * through purple the way real rain intensity would — blending colours instead
 * gives a muddy grey.
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
  const toCell = (i: number, out: number, cells: number) => ((i + 0.5) * cells) / out - 0.5
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) =>
      bilinear(mm, rows, cols, toCell(y, height, rows), toCell(x, width, cols)),
    ),
  ).flat()
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

function kernel(sigma: number): number[] {
  const radius = Math.ceil(sigma * 3)
  const k = Array.from({ length: radius * 2 + 1 }, (_, i) => Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)))
  const total = k.reduce((a, b) => a + b, 0)
  return k.map((v) => v / total)
}

function blurPass(src: readonly number[], width: number, height: number, k: readonly number[], horizontal: boolean): number[] {
  const radius = (k.length - 1) / 2
  const out = new Array<number>(src.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let weight = 0
      for (let j = -radius; j <= radius; j++) {
        const sx = horizontal ? x + j : x
        const sy = horizontal ? y : y + j
        if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue
        const v = src[sy * width + sx]
        if (!Number.isFinite(v)) continue
        sum += v * k[j + radius]
        weight += k[j + radius]
      }
      out[y * width + x] = weight === 0 ? Number.NaN : sum / weight
    }
  }
  return out
}

/**
 * Separable Gaussian blur of a value field. Open-Meteo snaps each requested
 * point to a nearby model point (elevation-aware), so neighbouring samples
 * often repeat one value and the field shows flat blocks with steps between
 * them. A blur of about half a model cell turns those into the soft blobs
 * the iOS map shows. Display only — the upstream total uses the raw numbers.
 * Missing pixels drop out of the weighting; edges renormalise.
 */
export function gaussianBlur(field: readonly number[], width: number, height: number, sigmaPx: number): number[] {
  if (sigmaPx <= 0) return [...field]
  const k = kernel(sigmaPx)
  return blurPass(blurPass(field, width, height, k, true), width, height, k, false)
}
