import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  findStation,
  parseHistoryBody,
  parseSnapshotXml,
} from './upstream'
import { UpstreamError } from '../types/upstream'

const fixturesDir = resolve(__dirname, '../test/fixtures')
const snapshotXml = readFileSync(resolve(fixturesDir, 'snapshot.xml'), 'utf8')
const historyText = readFileSync(resolve(fixturesDir, 'history-24h.txt'), 'utf8')

describe('parseSnapshotXml', () => {
  it('parses every SP_GET_LAST_STATUS_PINTU_AIR row', () => {
    const rows = parseSnapshotXml(snapshotXml)
    expect(rows.length).toBeGreaterThan(20)
  })

  it('finds Pesanggrahan (id 160) with correct fields', () => {
    const rows = parseSnapshotXml(snapshotXml)
    const station = findStation(rows, 160)
    expect(station).toBeDefined()
    expect(station!.name).toBe('P.S. Pesanggrahan 1')
    expect(station!.location).toBe('Pesanggrahan')
    expect(station!.lat).toBeCloseTo(-6.397147, 6)
    expect(station!.lng).toBeCloseTo(106.771833, 6)
    expect(station!.thresholdsCm).toEqual({ siaga1: 350, siaga2: 250, siaga3: 150 })
    expect(station!.statusText).toMatch(/Siaga/i)
  })

  it('converts mm to cm at parser boundary', () => {
    const rows = parseSnapshotXml(snapshotXml)
    const station = findStation(rows, 160)!
    expect(station.levelCm).toBeCloseTo(278, 1)
    expect(station.prevLevelCm).toBeCloseTo(279.4, 1)
  })

  it('parses TANGGAL into a Date with Asia/Jakarta offset', () => {
    const rows = parseSnapshotXml(snapshotXml)
    const station = findStation(rows, 160)!
    expect(station.observedAt).toBeInstanceOf(Date)
    expect(Number.isNaN(station.observedAt.getTime())).toBe(false)
  })

  it('throws UpstreamError on parse error', () => {
    expect(() => parseSnapshotXml('<not><valid>')).toThrow(UpstreamError)
  })

  it('returns empty array when XML has no rows', () => {
    const empty = '<?xml version="1.0"?><DocumentElement></DocumentElement>'
    expect(parseSnapshotXml(empty)).toEqual([])
  })

  it('returns null prevLevelCm when TINGGI_AIR_SEBELUMNYA is missing or empty', () => {
    const xml = `<?xml version="1.0"?><DocumentElement>
      <SP_GET_LAST_STATUS_PINTU_AIR>
        <ID_PINTU_AIR>999</ID_PINTU_AIR>
        <NAMA_PINTU_AIR>Test</NAMA_PINTU_AIR>
        <LOKASI>Test</LOKASI>
        <SIAGA1>1000</SIAGA1>
        <SIAGA2>700</SIAGA2>
        <SIAGA3>400</SIAGA3>
        <LATITUDE>-6.0</LATITUDE>
        <LONGITUDE>106.0</LONGITUDE>
        <TANGGAL>2026-04-30T10:00:00+07:00</TANGGAL>
        <TINGGI_AIR>500</TINGGI_AIR>
        <TINGGI_AIR_SEBELUMNYA></TINGGI_AIR_SEBELUMNYA>
        <STATUS_SIAGA>Status : Siaga 3</STATUS_SIAGA>
      </SP_GET_LAST_STATUS_PINTU_AIR>
    </DocumentElement>`
    const [row] = parseSnapshotXml(xml)
    expect(row.prevLevelCm).toBeNull()
  })

  it('drops rows with invalid id or level', () => {
    const xml = `<?xml version="1.0"?><DocumentElement>
      <SP_GET_LAST_STATUS_PINTU_AIR>
        <ID_PINTU_AIR>abc</ID_PINTU_AIR>
        <NAMA_PINTU_AIR>Bad</NAMA_PINTU_AIR>
        <LOKASI>Bad</LOKASI>
        <SIAGA1>100</SIAGA1><SIAGA2>50</SIAGA2><SIAGA3>20</SIAGA3>
        <LATITUDE>-6.0</LATITUDE><LONGITUDE>106.0</LONGITUDE>
        <TANGGAL>2026-04-30T10:00:00+07:00</TANGGAL>
        <TINGGI_AIR>not-a-number</TINGGI_AIR>
        <TINGGI_AIR_SEBELUMNYA></TINGGI_AIR_SEBELUMNYA>
        <STATUS_SIAGA>x</STATUS_SIAGA>
      </SP_GET_LAST_STATUS_PINTU_AIR>
    </DocumentElement>`
    expect(parseSnapshotXml(xml)).toEqual([])
  })
})

describe('parseHistoryBody', () => {
  it('parses the canned 24h fixture', () => {
    const result = parseHistoryBody(historyText)
    expect(result.points.length).toBeGreaterThan(100)
    expect(result.thresholdsCm).toEqual({ siaga1: 3500, siaga2: 2500, siaga3: 1500 })
    const first = result.points[0]
    expect(first.cm).toBeGreaterThan(0)
    expect(first.at).toBeInstanceOf(Date)
    expect(Number.isNaN(first.at.getTime())).toBe(false)
  })

  it('strips trailing HTML stub', () => {
    const body = '2026-04-30 10.00.00,150;2026-04-30 10.10.00,160;|3500;2500;1500|<html><body></body></html>'
    const r = parseHistoryBody(body)
    expect(r.points).toHaveLength(2)
    expect(r.points[0].cm).toBe(150)
    expect(r.points[1].cm).toBe(160)
    expect(r.thresholdsCm).toEqual({ siaga1: 3500, siaga2: 2500, siaga3: 1500 })
  })

  it('handles empty body without throwing', () => {
    const r = parseHistoryBody('')
    expect(r).toEqual({ points: [], thresholdsCm: null })
  })

  it('handles body with only HTML stub', () => {
    const r = parseHistoryBody('<html></html>')
    expect(r).toEqual({ points: [], thresholdsCm: null })
  })

  it('parses single-digit hours', () => {
    const body = '2026-04-30 9.05.00,123;|3500;2500;1500|'
    const r = parseHistoryBody(body)
    expect(r.points).toHaveLength(1)
    expect(r.points[0].cm).toBe(123)
    expect(r.points[0].at.toISOString()).toBe('2026-04-30T02:05:00.000Z')
  })

  it('drops corrupt points but keeps the rest', () => {
    const body = '2026-04-30 10.00.00,abc;2026-04-30 10.10.00,160;,;|3500;2500;1500|'
    const r = parseHistoryBody(body)
    expect(r.points.map((p) => p.cm)).toEqual([160])
  })
})
