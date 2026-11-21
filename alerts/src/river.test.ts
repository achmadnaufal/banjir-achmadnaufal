import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { HistoryResponse } from '../../app/src/types/upstream'
import { readRiver } from './river'

// Captured 2026-11-21 19:51 WIB, the evening the DSDA sensor for gate 160 was silent.
const BPBD = readFileSync(resolve(__dirname, '../../app/src/test/fixtures/bpbd-charttma.json'), 'utf8')
const NOW = new Date('2026-11-21T19:55:00+07:00')
const SILENT_SERIES = '' // what DSDA serves for gate 160 since 18 Nov: no points
const LIVE_SERIES = '2026-11-21 19.40.00,225;2026-11-21 19.50.00,230|3500;2500;1500'

type Route = (url: string, init?: RequestInit) => Response | Promise<Response>

function ok(body: string): Response {
  return new Response(body, { status: 200 })
}

function fakeFetch(dsda: Route, bpbd: Route) {
  const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('charttma')) return bpbd(url, init)
    if (url.includes('GenerateDataTinggiAir')) return dsda(url, init)
    throw new Error(`unexpected fetch ${url}`)
  })
  return fn as unknown as typeof fetch & typeof fn
}

function bpbdCalls(f: ReturnType<typeof fakeFetch>) {
  return f.mock.calls.filter(([u]) => String(u).includes('charttma'))
}

const STORED_YESTERDAY: HistoryResponse = {
  points: [{ at: new Date('2026-11-20T23:00:00+07:00'), cm: 95 }],
  thresholdsCm: { siaga1: 350, siaga2: 250, siaga3: 150 },
}

describe('readRiver', () => {
  it('reads BPBD when the sensor series is silent', async () => {
    const r = await readRiver(fakeFetch(() => ok(SILENT_SERIES), () => ok(BPBD)), NOW, null)
    expect(r.ok).toBe(true)
    expect(r.reading).toMatchObject({
      levelCm: 200,
      band: 'siaga3',
      source: 'manual',
      prevLevelCm: 190,
      observedAt: new Date('2026-11-21T19:00:00+07:00'),
      thresholdsCm: { siaga1: 350, siaga2: 250, siaga3: 150 },
    })
    // 17:00 170, 18:00 190, 19:00 200 -> least-squares 15 cm/h.
    expect(r.reading?.ratePerHour).toBeCloseTo(15, 5)
  })

  it('prefers a live sensor series', async () => {
    const r = await readRiver(fakeFetch(() => ok(LIVE_SERIES), () => ok(BPBD)), NOW, null)
    expect(r.reading?.source).toBe('sensor')
    expect(r.reading?.levelCm).toBe(230)
  })

  it('merges BPBD into the stored table', async () => {
    const r = await readRiver(fakeFetch(() => ok(SILENT_SERIES), () => ok(BPBD)), NOW, STORED_YESTERDAY)
    expect(r.bpbdTable?.points).toHaveLength(21)
    expect(r.bpbdTable?.points[0]).toEqual(STORED_YESTERDAY.points[0])
  })

  it('keeps the stored table when BPBD sends an HTML maintenance page', async () => {
    const f = fakeFetch(() => ok(SILENT_SERIES), () => ok('<html>Sedang pemeliharaan</html>'))
    const r = await readRiver(f, NOW, STORED_YESTERDAY)
    expect(r.bpbdTable).toEqual(STORED_YESTERDAY)
    expect(r.problems.filter((p) => p.startsWith('bpbd:'))).toHaveLength(1)
  })

  it('retries BPBD once after a 503', async () => {
    let calls = 0
    const f = fakeFetch(
      () => ok(SILENT_SERIES),
      () => (++calls === 1 ? new Response('busy', { status: 503 }) : ok(BPBD)),
    )
    const r = await readRiver(f, NOW, null)
    expect(bpbdCalls(f)).toHaveLength(2)
    expect(r.reading?.levelCm).toBe(200)
    expect(r.problems).toEqual([])
  })

  it('reports not ok when both sources fail, still reading the stored table', async () => {
    const down = () => new Response('down', { status: 503 })
    const r = await readRiver(fakeFetch(down, down), NOW, STORED_YESTERDAY)
    expect(r.ok).toBe(false)
    expect(r.problems).toHaveLength(2)
    expect(r.reading?.levelCm).toBe(95)
    expect(r.bpbdTable).toEqual(STORED_YESTERDAY)
  })

  it('does not count an empty DSDA series as reading the river', async () => {
    // DSDA answers 200 with nothing for gate 160; with BPBD down the watcher is blind.
    const r = await readRiver(fakeFetch(() => ok(SILENT_SERIES), () => new Response('down', { status: 503 })), NOW, null)
    expect(r.ok).toBe(false)
  })

  it('counts an empty BPBD table as answering (it resets at midnight)', async () => {
    const empty = JSON.stringify({ time: '', ketinggian: '', siaga1: '', siaga2: '', siaga3: '' })
    const r = await readRiver(fakeFetch(() => ok(SILENT_SERIES), () => ok(empty)), NOW, null)
    expect(r.ok).toBe(true)
  })

  it('has no reading when both sources fail and nothing is stored', async () => {
    const down = () => new Response('down', { status: 503 })
    const r = await readRiver(fakeFetch(down, down), NOW, null)
    expect(r.reading).toBeNull()
    expect(r.bpbdTable).toBeNull()
  })

  it('posts the same form the page does', async () => {
    const f = fakeFetch(() => ok(SILENT_SERIES), () => ok(BPBD))
    await readRiver(f, NOW, null)
    const [, init] = bpbdCalls(f)[0]
    expect(init?.method).toBe('POST')
    expect(String(init?.body)).toBe('pintuair_id=2&pintuair=Pos+Pesanggrahan')
  })

  it('asks DSDA for the last 24 hours of gate 160', async () => {
    const f = fakeFetch(() => ok(SILENT_SERIES), () => ok(BPBD))
    await readRiver(f, NOW, null)
    const dsdaUrl = String(f.mock.calls.find(([u]) => String(u).includes('GenerateDataTinggiAir'))?.[0])
    expect(dsdaUrl).toContain('IdPintuAir=160')
    expect(dsdaUrl).toContain('StartDate=20-11-2026')
    expect(dsdaUrl).toContain('EndDate=21-11-2026')
  })
})
