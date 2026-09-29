import { describe, expect, it } from 'vitest'
import { RAIN_SCALE, rainColor } from './rainColor'

describe('rainColor', () => {
  it('leaves dry and missing cells transparent', () => {
    expect(rainColor(0)).toBeNull()
    expect(rainColor(0.05)).toBeNull()
    expect(rainColor(Number.NaN)).toBeNull()
    expect(rainColor(-1)).toBeNull()
  })

  it('picks the highest band the value reaches', () => {
    expect(rainColor(RAIN_SCALE[0].minMm)).toEqual(RAIN_SCALE[0].rgba)
    expect(rainColor(RAIN_SCALE[1].minMm + 0.01)).toEqual(RAIN_SCALE[1].rgba)
    expect(rainColor(999)).toEqual(RAIN_SCALE[RAIN_SCALE.length - 1].rgba)
  })

  it('keeps bands in ascending order', () => {
    const mins = RAIN_SCALE.map((b) => b.minMm)
    expect([...mins].sort((a, b) => a - b)).toEqual(mins)
  })
})
