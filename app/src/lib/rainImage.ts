import { rainColor } from './rainColor'

/**
 * RGBA pixels for a rows × cols image of one forecast frame — one pixel per
 * grid cell. The map stretches this tiny image over the forecast area and the
 * browser's smoothing blends neighbouring cells, which is what gives the
 * soft, iOS-like look without any interpolation code.
 */
export function frameToPixels(mm: readonly number[], rows: number, cols: number): Uint8ClampedArray<ArrayBuffer> {
  if (mm.length !== rows * cols) {
    throw new RangeError(`Frame has ${mm.length} cells, grid expects ${rows * cols}`)
  }
  const pixels = new Uint8ClampedArray(rows * cols * 4)
  mm.forEach((value, i) => {
    const rgba = rainColor(value)
    if (rgba) pixels.set(rgba, i * 4)
  })
  return pixels
}
