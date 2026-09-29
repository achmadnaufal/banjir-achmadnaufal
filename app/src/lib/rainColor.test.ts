import { describe, expect, it } from 'vitest'
import { RAIN_STOPS, rainColor } from './rainColor'

describe('rainColor', () => {
  it('leaves dry and missing cells transparent', () => {
    expect(rainColor(0)).toBeNull()
    expect(rainColor(0.05)).toBeNull()
    expect(rainColor(Number.NaN)).toBeNull()
    expect(rainColor(-1)).toBeNull()
  })

  it('hits each stop exactly', () => {
    for (const stop of RAIN_STOPS.slice(1)) {
      expect(rainColor(stop.mm)).toEqual(stop.rgba)
    }
  })

  it('blends between neighbouring stops', () => {
    const [a, b] = [RAIN_STOPS[3], RAIN_STOPS[4]]
    const mid = rainColor((a.mm + b.mm) / 2)
    expect(mid).not.toBeNull()
    mid!.forEach((channel, i) => {
      expect(channel).toBeCloseTo((a.rgba[i] + b.rgba[i]) / 2, 0)
    })
  })

  it('follows the iOS ramp: blue light, purple moderate, yellow heavy, pale yellow extreme', () => {
    const [lr, , lb] = rainColor(2)!
    expect(lb).toBeGreaterThan(lr) // blue
    const [mr, mg, mb] = rainColor(5)!
    expect(mr).toBeGreaterThan(mg)
    expect(mb).toBeGreaterThan(mg) // purple
    const [hr, hg, hb] = rainColor(10)!
    expect(hr).toBeGreaterThan(hb)
    expect(hg).toBeGreaterThan(hb) // yellow
    const [, , eb] = rainColor(40)!
    expect(eb).toBeGreaterThan(hb) // paler than heavy
  })

  it('keeps stops in ascending order', () => {
    const mms = RAIN_STOPS.map((s) => s.mm)
    expect([...mms].sort((x, y) => x - y)).toEqual(mms)
  })
})
