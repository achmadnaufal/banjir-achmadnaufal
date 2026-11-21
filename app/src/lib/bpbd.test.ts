import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpstreamError } from '../types/upstream'
import { buildBpbdBody, fetchBpbdReadings, parseBpbdReadings } from './bpbd'

// Captured from bpbd.jakarta.go.id/api/charttma on 2026-11-21 at 19:51 WIB,
// the evening the DSDA sensor feed for gate 160 had been silent for 3 days.
const fixture = readFileSync(resolve(__dirname, '../test/fixtures/bpbd-charttma.json'), 'utf8')
const CAPTURED_AT = new Date('2026-11-21T19:51:00+07:00')

function payload(time: string, ketinggian: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    pintu_air: 'Pos Pesanggrahan',
    time,
    ketinggian,
    siaga1: '350',
    siaga2: '250',
    siaga3: '150',
    ...extra,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseBpbdReadings', () => {
  it('stamps each hourly reading with the Jakarta date of `now`', () => {
    const r = parseBpbdReadings(fixture, CAPTURED_AT)
    expect(r.points).toHaveLength(20)
    expect(r.points[0]).toEqual({ at: new Date('2026-11-21T00:00:00+07:00'), cm: 95 })
    expect(r.points.at(-1)).toEqual({ at: new Date('2026-11-21T19:00:00+07:00'), cm: 200 })
  })

  it('reads the thresholds, which BPBD already sends in cm', () => {
    expect(parseBpbdReadings(fixture, CAPTURED_AT).thresholdsCm).toEqual({
      siaga1: 350,
      siaga2: 250,
      siaga3: 150,
    })
  })

  it('uses the Jakarta date while UTC is still on the previous day', () => {
    // 06:30 WIB on 22 Nov is 23:30 UTC on 21 Nov.
    const r = parseBpbdReadings(payload('00:00,06:00', '90,95'), new Date('2026-11-21T23:30:00Z'))
    expect(r.points.map((p) => p.at.toISOString())).toEqual([
      '2026-11-21T17:00:00.000Z',
      '2026-11-21T23:00:00.000Z',
    ])
  })

  it('skips hours that have no usable reading', () => {
    const r = parseBpbdReadings(payload('00:00,01:00,02:00,03:00', '90,,-,null'), CAPTURED_AT)
    expect(r.points).toEqual([{ at: new Date('2026-11-21T00:00:00+07:00'), cm: 90 }])
  })

  it("dates yesterday's table as yesterday when it is still served after midnight", () => {
    // Stamped with today's date, the 23:00 reading would sit in the future.
    const r = parseBpbdReadings(payload('00:00,23:00', '90,95'), new Date('2026-11-22T00:20:00+07:00'))
    expect(r.points).toEqual([
      { at: new Date('2026-11-21T00:00:00+07:00'), cm: 90 },
      { at: new Date('2026-11-21T23:00:00+07:00'), cm: 95 },
    ])
  })

  it('tolerates a phone clock running a few minutes behind', () => {
    const r = parseBpbdReadings(payload('19:00', '200'), new Date('2026-11-21T18:55:00+07:00'))
    expect(r.points).toHaveLength(1)
  })

  it('keeps the table on a phone clock up to two hours slow', () => {
    // Real time 14:04, phone says 12:10 — the 14:00 reading is still today's.
    const r = parseBpbdReadings(payload('13:00,14:00', '90,95'), new Date('2026-11-21T12:10:00+07:00'))
    expect(r.points.map((p) => p.at)).toEqual([
      new Date('2026-11-21T13:00:00+07:00'),
      new Date('2026-11-21T14:00:00+07:00'),
    ])
  })

  it('returns readings in time order', () => {
    const r = parseBpbdReadings(payload('02:00,00:00,01:00', '3,1,2'), CAPTURED_AT)
    expect(r.points.map((p) => p.cm)).toEqual([1, 2, 3])
  })

  it('has no thresholds when a band is missing', () => {
    const r = parseBpbdReadings(payload('00:00', '90', { siaga2: '' }), CAPTURED_AT)
    expect(r.thresholdsCm).toBeNull()
    expect(r.points).toHaveLength(1)
  })

  it('throws a parse error on a non-JSON body', () => {
    expect(() => parseBpbdReadings('<html>maintenance</html>', CAPTURED_AT)).toThrow(UpstreamError)
  })

  it('throws a parse error when the series are missing', () => {
    expect(() => parseBpbdReadings(JSON.stringify({ pintu_air: null }), CAPTURED_AT)).toThrow(
      UpstreamError,
    )
  })

  it('throws a parse error when times and levels cannot be paired', () => {
    expect(() => parseBpbdReadings(payload('00:00,01:00', '90'), CAPTURED_AT)).toThrow(UpstreamError)
  })
})

describe('buildBpbdBody', () => {
  it('mirrors the form the BPBD water-level page posts', () => {
    expect(buildBpbdBody({ id: 2, name: 'Pos Pesanggrahan' }).toString()).toBe(
      'pintuair_id=2&pintuair=Pos+Pesanggrahan',
    )
  })
})

describe('fetchBpbdReadings', () => {
  it('POSTs the form and parses the reply', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(fixture, { status: 200 }))
    const r = await fetchBpbdReadings(CAPTURED_AT)
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe('https://bpbd.jakarta.go.id/api/charttma')
    expect(init?.method).toBe('POST')
    expect(String(init?.body)).toBe('pintuair_id=2&pintuair=Pos+Pesanggrahan')
    expect(r.points.at(-1)?.cm).toBe(200)
  })
})
