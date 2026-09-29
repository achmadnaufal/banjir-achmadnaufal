import { describe, expect, it } from 'vitest'
import { frameToPixels } from './rainImage'
import { RAIN_SCALE } from './rainColor'

describe('frameToPixels', () => {
  it('writes one RGBA pixel per cell, transparent where dry', () => {
    const px = frameToPixels([0, 30], 1, 2)
    expect(px).toHaveLength(8)
    expect(Array.from(px.slice(0, 4))).toEqual([0, 0, 0, 0])
    expect(Array.from(px.slice(4, 8))).toEqual([...RAIN_SCALE[RAIN_SCALE.length - 1].rgba])
  })

  it('rejects a frame that does not match the grid', () => {
    expect(() => frameToPixels([1, 2, 3], 2, 2)).toThrow(RangeError)
  })
})
