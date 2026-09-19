import { describe, expect, it } from 'vitest'
import {
  RANK,
  bands,
  classify,
  detectTransition,
  siagaMeta,
  trend,
} from './siaga'
import type { ThresholdsCm } from '../types/upstream'

const T: ThresholdsCm = { siaga1: 350, siaga2: 250, siaga3: 150 }

describe('classify', () => {
  it.each<[number, ReturnType<typeof classify>]>([
    [0, 'normal'],
    [149, 'normal'],
    [150, 'normal'],
    [151, 'siaga3'],
    [200, 'siaga3'],
    [250, 'siaga3'],
    [251, 'siaga2'],
    [300, 'siaga2'],
    [350, 'siaga2'],
    [351, 'siaga1'],
    [500, 'siaga1'],
    [9999, 'siaga1'],
  ])('classifies %i cm as %s', (cm, expected) => {
    expect(classify(cm, T)).toBe(expected)
  })

  it('handles negative readings as normal', () => {
    expect(classify(-5, T)).toBe('normal')
  })
})

describe('siagaMeta', () => {
  // Labels mirror the official DSDA DKI "KETERANGAN" legend, which names the
  // bands BAHAYA / SIAGA / WASPADA / Normal rather than Siaga 1 / 2 / 3.
  it('returns red+rank3 for siaga1', () => {
    expect(siagaMeta('siaga1')).toEqual({ label: 'BAHAYA', tone: 'red', rank: 3 })
  })
  it('returns orange+rank2 for siaga2', () => {
    expect(siagaMeta('siaga2')).toEqual({ label: 'SIAGA', tone: 'orange', rank: 2 })
  })
  it('returns yellow+rank1 for siaga3', () => {
    expect(siagaMeta('siaga3')).toEqual({ label: 'WASPADA', tone: 'yellow', rank: 1 })
  })
  it('returns green+rank0 for normal', () => {
    expect(siagaMeta('normal')).toEqual({ label: 'NORMAL', tone: 'green', rank: 0 })
  })
})

describe('bands', () => {
  it('lists the four legend rows highest-first', () => {
    expect(bands(T)).toEqual([
      { level: 'siaga1', label: 'BAHAYA', tone: 'red', rank: 3, rangeText: '> 350 cm' },
      { level: 'siaga2', label: 'SIAGA', tone: 'orange', rank: 2, rangeText: '250 - 350 cm' },
      { level: 'siaga3', label: 'WASPADA', tone: 'yellow', rank: 1, rangeText: '150 - 250 cm' },
      { level: 'normal', label: 'NORMAL', tone: 'green', rank: 0, rangeText: '< 150 cm' },
    ])
  })

  it('follows upstream thresholds rather than hardcoding the fallback', () => {
    const custom: ThresholdsCm = { siaga1: 400, siaga2: 300, siaga3: 200 }
    expect(bands(custom).map((b) => b.rangeText)).toEqual([
      '> 400 cm',
      '300 - 400 cm',
      '200 - 300 cm',
      '< 200 cm',
    ])
  })

  it('rounds fractional thresholds from the mm-to-cm conversion', () => {
    const fractional: ThresholdsCm = { siaga1: 350.4, siaga2: 249.5, siaga3: 150.6 }
    expect(bands(fractional).map((b) => b.rangeText)).toEqual([
      '> 350 cm',
      '250 - 350 cm',
      '151 - 250 cm',
      '< 151 cm',
    ])
  })

  it('classifies a level into the band it is listed under', () => {
    for (const cm of [0, 150, 151, 250, 251, 350, 351, 900]) {
      const level = classify(cm, T)
      expect(bands(T).some((b) => b.level === level)).toBe(true)
    }
  })

  it('does not mutate the thresholds it is given', () => {
    const input: ThresholdsCm = { siaga1: 350, siaga2: 250, siaga3: 150 }
    bands(input)
    expect(input).toEqual({ siaga1: 350, siaga2: 250, siaga3: 150 })
  })
})

describe('RANK ordering', () => {
  it('places normal lowest and siaga1 highest', () => {
    expect(RANK.normal).toBe(0)
    expect(RANK.siaga3).toBe(1)
    expect(RANK.siaga2).toBe(2)
    expect(RANK.siaga1).toBe(3)
  })
})

describe('detectTransition', () => {
  it('returns no change when prev is null (first observation)', () => {
    expect(detectTransition(null, 'siaga2')).toEqual({ changed: false, direction: 'none' })
  })

  it('returns no change when level is unchanged', () => {
    expect(detectTransition('siaga2', 'siaga2')).toEqual({ changed: false, direction: 'none' })
  })

  it('detects rising transition normal -> siaga3', () => {
    expect(detectTransition('normal', 'siaga3')).toEqual({ changed: true, direction: 'rising' })
  })

  it('detects rising transition with skip-level normal -> siaga1', () => {
    expect(detectTransition('normal', 'siaga1')).toEqual({ changed: true, direction: 'rising' })
  })

  it('detects rising transition siaga3 -> siaga1', () => {
    expect(detectTransition('siaga3', 'siaga1')).toEqual({ changed: true, direction: 'rising' })
  })

  it('detects falling transition siaga2 -> siaga3', () => {
    expect(detectTransition('siaga2', 'siaga3')).toEqual({ changed: true, direction: 'falling' })
  })

  it('detects falling transition siaga1 -> normal', () => {
    expect(detectTransition('siaga1', 'normal')).toEqual({ changed: true, direction: 'falling' })
  })
})

describe('trend', () => {
  it('returns flat when prev is null', () => {
    expect(trend(null, 200)).toBe('flat')
  })
  it('returns up when next > prev', () => {
    expect(trend(200, 210)).toBe('up')
  })
  it('returns down when next < prev', () => {
    expect(trend(210, 200)).toBe('down')
  })
  it('returns flat when equal', () => {
    expect(trend(200, 200)).toBe('flat')
  })
})
