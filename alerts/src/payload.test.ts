import { afterEach, describe, expect, it } from 'vitest'
import { buildAlertPayload, buildOwnerPayload, buildTestPayload } from './payload'
import type { RiverReading } from './river'

const T = { siaga1: 350, siaga2: 250, siaga3: 150 }

function reading(over: Partial<RiverReading> = {}): RiverReading {
  return {
    levelCm: 200,
    band: 'siaga3',
    observedAt: new Date('2026-11-21T19:00:00+07:00'),
    prevLevelCm: 190,
    ratePerHour: 10,
    source: 'manual',
    cadence: 'hourly',
    thresholdsCm: T,
    ...over,
  }
}

const originalTz = process.env.TZ
afterEach(() => {
  process.env.TZ = originalTz
})

describe('buildAlertPayload', () => {
  it('writes the Indonesian alert from the approved sketch', () => {
    expect(buildAlertPayload('alert', reading(), 'id')).toEqual({
      title: 'WASPADA · 200 cm ▲ naik',
      body: 'Pos Pesanggrahan, 19:00 · +10 cm/jam · SIAGA di 250 cm',
      tag: 'banjir-siaga3',
      url: '/?source=push',
    })
  })

  it('writes the English alert', () => {
    const p = buildAlertPayload('alert', reading(), 'en')
    expect(p.title).toBe('WASPADA · 200 cm ▲ rising')
    expect(p.body).toBe('Pos Pesanggrahan, 19:00 · +10 cm/h · SIAGA at 250 cm')
  })

  it('says when the river is falling', () => {
    const p = buildAlertPayload('alert', reading({ levelCm: 190, prevLevelCm: 200, ratePerHour: -10.4 }), 'id')
    expect(p.title).toBe('WASPADA · 190 cm ▼ turun')
    expect(p.body).toBe('Pos Pesanggrahan, 19:00 · -10 cm/jam · SIAGA di 250 cm')
  })

  it('says when the river is steady', () => {
    const p = buildAlertPayload('alert', reading({ prevLevelCm: 200, ratePerHour: 0.2 }), 'en')
    expect(p.title).toBe('WASPADA · 200 cm ■ steady')
    expect(p.body).toBe('Pos Pesanggrahan, 19:00 · 0 cm/h · SIAGA at 250 cm')
  })

  it('leaves out an unknown rate', () => {
    expect(buildAlertPayload('alert', reading({ ratePerHour: null }), 'id').body).toBe(
      'Pos Pesanggrahan, 19:00 · SIAGA di 250 cm',
    )
  })

  it('names the next band up from a level exactly on a threshold', () => {
    const p = buildAlertPayload('escalation', reading({ levelCm: 250, band: 'siaga2' }), 'en')
    expect(p.title).toBe('SIAGA · 250 cm ▲ rising')
    expect(p.body).toBe('Pos Pesanggrahan, 19:00 · +10 cm/h · BAHAYA at 350 cm')
    expect(p.tag).toBe('banjir-siaga2')
  })

  it('has no next band at BAHAYA', () => {
    const p = buildAlertPayload('escalation', reading({ levelCm: 360, band: 'siaga1' }), 'id')
    expect(p.title).toBe('BAHAYA · 360 cm ▲ naik')
    expect(p.body).toBe('Pos Pesanggrahan, 19:00 · +10 cm/jam')
  })

  it('writes the all-clear', () => {
    const p = buildAlertPayload('allClear', reading({ levelCm: 140, band: 'normal', prevLevelCm: 145 }), 'id')
    expect(p).toEqual({
      title: 'Kembali normal · 140 cm',
      body: 'Pos Pesanggrahan, 19:00',
      tag: 'banjir-normal',
      url: '/?source=push',
    })
    expect(buildAlertPayload('allClear', reading({ levelCm: 140, band: 'normal' }), 'en').title).toBe(
      'Back to normal · 140 cm',
    )
  })

  it('rounds the level to whole centimetres', () => {
    expect(buildAlertPayload('alert', reading({ levelCm: 199.6 }), 'id').title).toBe('WASPADA · 200 cm ▲ naik')
  })

  it('writes WIB times even on a UTC server clock', () => {
    process.env.TZ = 'UTC'
    const p = buildAlertPayload('alert', reading({ observedAt: new Date('2026-11-21T12:00:00Z') }), 'id')
    expect(p.body.startsWith('Pos Pesanggrahan, 19:00')).toBe(true)
  })
})

describe('buildTestPayload', () => {
  it('confirms alerts are on, in each language', () => {
    expect(buildTestPayload('id')).toEqual({
      title: 'Tes peringatan banjir',
      body: 'Peringatan aktif di ponsel ini.',
      tag: 'banjir-test',
      url: '/?source=push',
    })
    expect(buildTestPayload('en')).toMatchObject({
      title: 'Flood alert test',
      body: 'Alerts are on for this phone.',
    })
  })
})

describe('buildOwnerPayload', () => {
  it('tells the owner the watcher cannot read the river', () => {
    expect(buildOwnerPayload(new Date('2026-11-21T12:00:00Z'), 'id')).toEqual({
      title: 'Peringatan banjir tidak bisa membaca sungai',
      body: 'Bacaan terakhir: 19:00',
      tag: 'banjir-owner',
      url: '/?source=push',
    })
    expect(buildOwnerPayload(null, 'en')).toMatchObject({
      title: "Flood alerts can't read the river",
      body: 'Last reading: —',
    })
  })
})
