import { describe, expect, it } from 'vitest'
import { parseStoredSnapshot, serializeSnapshot } from './snapshotCache'
import type { SnapshotRow } from '../types/upstream'

const ROW: SnapshotRow = {
  id: 160,
  name: 'P.S. Pesanggrahan 1',
  location: 'Pesanggrahan',
  lat: -6.397147,
  lng: 106.771833,
  thresholdsCm: { siaga1: 350, siaga2: 250, siaga3: 150 },
  observedAt: new Date('2026-09-19T03:00:00.000Z'),
  levelCm: 180,
  prevLevelCm: 170,
  statusText: 'Siaga 3',
}

describe('parseStoredSnapshot', () => {
  it('round-trips a snapshot written by serializeSnapshot', () => {
    const parsed = parseStoredSnapshot(serializeSnapshot(ROW))
    expect(parsed).not.toBeNull()
    expect(parsed!.levelCm).toBe(180)
    expect(parsed!.prevLevelCm).toBe(170)
    expect(parsed!.thresholdsCm).toEqual({ siaga1: 350, siaga2: 250, siaga3: 150 })
    expect(parsed!.observedAt.toISOString()).toBe('2026-09-19T03:00:00.000Z')
  })

  it('accepts a null prevLevelCm', () => {
    const parsed = parseStoredSnapshot(serializeSnapshot({ ...ROW, prevLevelCm: null }))
    expect(parsed!.prevLevelCm).toBeNull()
  })

  it.each<[string, string]>([
    ['null input', 'null'],
    ['not json', '{oops'],
    ['not an object', '"a string"'],
    ['a bare array', '[]'],
    // The crash that prompted this: an entry missing thresholds reached
    // classify() and threw on t.siaga1.
    ['missing thresholds', JSON.stringify({ observedAtIso: '2026-09-19T03:00:00.000Z', levelCm: 180, prevLevelCm: 170, statusText: '' })],
    ['partial thresholds', JSON.stringify({ observedAtIso: '2026-09-19T03:00:00.000Z', levelCm: 180, prevLevelCm: null, statusText: '', thresholdsCm: { siaga1: 350 } })],
    ['non-numeric threshold', JSON.stringify({ observedAtIso: '2026-09-19T03:00:00.000Z', levelCm: 180, prevLevelCm: null, statusText: '', thresholdsCm: { siaga1: 'x', siaga2: 250, siaga3: 150 } })],
    ['unparseable date', JSON.stringify({ observedAtIso: 'not-a-date', levelCm: 180, prevLevelCm: null, statusText: '', thresholdsCm: { siaga1: 350, siaga2: 250, siaga3: 150 } })],
    ['missing level', JSON.stringify({ observedAtIso: '2026-09-19T03:00:00.000Z', prevLevelCm: null, statusText: '', thresholdsCm: { siaga1: 350, siaga2: 250, siaga3: 150 } })],
    ['NaN level', JSON.stringify({ observedAtIso: '2026-09-19T03:00:00.000Z', levelCm: null, prevLevelCm: null, statusText: '', thresholdsCm: { siaga1: 350, siaga2: 250, siaga3: 150 } })],
  ])('returns null for %s rather than throwing', (_label, raw) => {
    expect(parseStoredSnapshot(raw)).toBeNull()
  })

  it('returns null for a missing entry', () => {
    expect(parseStoredSnapshot(null)).toBeNull()
  })

  it('tolerates a missing statusText by defaulting it', () => {
    const raw = JSON.stringify({
      observedAtIso: '2026-09-19T03:00:00.000Z',
      levelCm: 180,
      prevLevelCm: null,
      thresholdsCm: { siaga1: 350, siaga2: 250, siaga3: 150 },
    })
    expect(parseStoredSnapshot(raw)?.statusText).toBe('')
  })
})
