import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildHistoryUrl, fetchHistory, fetchSnapshot } from './upstream'

const fixturesDir = resolve(__dirname, '../test/fixtures')
const snapshotXml = readFileSync(resolve(fixturesDir, 'snapshot.xml'), 'utf8')
const historyText = readFileSync(resolve(fixturesDir, 'history-24h.txt'), 'utf8')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildHistoryUrl', () => {
  it('formats dates as dd-MM-yyyy in Asia/Jakarta', () => {
    const start = new Date('2026-04-29T17:00:00Z') // 30 Apr 00:00 WIB
    const end = new Date('2026-04-30T16:59:59Z') // 30 Apr 23:59 WIB
    const url = buildHistoryUrl(160, start, end)
    expect(url).toContain('IdPintuAir=160')
    expect(url).toContain('StartDate=30-04-2026')
    expect(url).toContain('EndDate=30-04-2026')
  })
})

describe('fetchSnapshot', () => {
  it('parses canned XML response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(snapshotXml, { status: 200 }))
    const rows = await fetchSnapshot()
    expect(rows.length).toBeGreaterThan(20)
    expect(rows.find((r) => r.id === 160)?.name).toBe('P.S. Pesanggrahan 1')
  })
})

describe('fetchHistory', () => {
  it('parses canned text response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(historyText, { status: 200 }))
    const r = await fetchHistory(160, new Date('2026-04-29T00:00:00+07:00'), new Date('2026-04-30T23:59:00+07:00'))
    expect(r.points.length).toBeGreaterThan(100)
    expect(r.thresholdsCm).toEqual({ siaga1: 3500, siaga2: 2500, siaga3: 1500 })
  })
})
