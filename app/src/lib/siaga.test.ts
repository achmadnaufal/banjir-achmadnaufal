import { describe, expect, it } from 'vitest'
import {
  RANK,
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
  it('returns red+rank3 for siaga1', () => {
    expect(siagaMeta('siaga1')).toEqual({ label: 'SIAGA 1', tone: 'red', rank: 3 })
  })
  it('returns orange+rank2 for siaga2', () => {
    expect(siagaMeta('siaga2')).toEqual({ label: 'SIAGA 2', tone: 'orange', rank: 2 })
  })
  it('returns yellow+rank1 for siaga3', () => {
    expect(siagaMeta('siaga3')).toEqual({ label: 'SIAGA 3', tone: 'yellow', rank: 1 })
  })
  it('returns green+rank0 for normal', () => {
    expect(siagaMeta('normal')).toEqual({ label: 'NORMAL', tone: 'green', rank: 0 })
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
