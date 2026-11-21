import { describe, expect, it } from 'vitest'
import type { HistoryResponse } from '../types/upstream'
import { parseStoredManual, serializeManual } from './manualCache'

const TABLE: HistoryResponse = {
  points: [
    { at: new Date('2026-11-21T18:00:00+07:00'), cm: 190 },
    { at: new Date('2026-11-21T19:00:00+07:00'), cm: 200 },
  ],
  thresholdsCm: { siaga1: 350, siaga2: 250, siaga3: 150 },
}

describe('manual table cache', () => {
  it('round-trips a table', () => {
    expect(parseStoredManual(serializeManual(TABLE))).toEqual(TABLE)
  })

  it('round-trips a table without thresholds', () => {
    const noBands = { ...TABLE, thresholdsCm: null }
    expect(parseStoredManual(serializeManual(noBands))).toEqual(noBands)
  })

  it.each([
    ['nothing stored', null],
    ['not JSON', '{oops'],
    ['wrong shape', '[1,2]'],
    ['points missing', JSON.stringify({ thresholdsCm: null })],
    ['a bad timestamp', JSON.stringify({ points: [{ atIso: 'nope', cm: 1 }], thresholdsCm: null })],
    ['a non-numeric level', JSON.stringify({ points: [{ atIso: '2026-11-21T12:00:00Z', cm: '1' }], thresholdsCm: null })],
    ['half a threshold set', JSON.stringify({ points: [], thresholdsCm: { siaga1: 350 } })],
  ])('rejects %s', (_label, raw) => {
    expect(parseStoredManual(raw)).toBeNull()
  })
})
