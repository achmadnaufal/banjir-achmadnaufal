import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderWithLocale } from '../test/render'
import { KeteranganLegend } from './KeteranganLegend'
import type { ThresholdsCm } from '../types/upstream'

const T: ThresholdsCm = { siaga1: 350, siaga2: 250, siaga3: 150 }

function rows() {
  return within(screen.getByRole('region', { name: /keterangan|legend/i })).getAllByRole('listitem')
}

afterEach(() => localStorage.clear())

describe('KeteranganLegend', () => {
  it('renders the four official bands highest-first', () => {
    renderWithLocale(<KeteranganLegend thresholdsCm={T} />, 'id')
    expect(rows().map((li) => li.textContent)).toEqual([
      '> 350 cmBAHAYA',
      '250 - 350 cmSIAGA',
      '150 - 250 cmWASPADA',
      '< 150 cmNORMAL',
    ])
  })

  // The band names are what DSDA and BPBD announcements actually say, so they
  // stay untranslated; English readers get a gloss beside them instead.
  it('keeps the official band names in English and adds a gloss', () => {
    renderWithLocale(<KeteranganLegend thresholdsCm={T} />, 'en')
    const text = rows().map((li) => li.textContent)
    expect(text[0]).toContain('BAHAYA')
    expect(text[0]).toContain('Danger')
    expect(text[2]).toContain('WASPADA')
    expect(text[2]).toContain('Caution')
  })

  it('reflects upstream thresholds rather than the hardcoded fallback', () => {
    renderWithLocale(<KeteranganLegend thresholdsCm={{ siaga1: 400, siaga2: 300, siaga3: 200 }} />)
    expect(screen.getByText('> 400 cm')).toBeInTheDocument()
    expect(screen.getByText('< 200 cm')).toBeInTheDocument()
  })

  it('marks the current band and only that one', () => {
    renderWithLocale(<KeteranganLegend thresholdsCm={T} currentLevel="siaga3" />)
    const marked = rows().filter((li) => li.getAttribute('aria-current') === 'true')
    expect(marked).toHaveLength(1)
    expect(marked[0]).toHaveTextContent('WASPADA')
  })

  it('marks nothing before the first reading arrives', () => {
    renderWithLocale(<KeteranganLegend thresholdsCm={T} currentLevel={null} />)
    expect(rows().some((li) => li.hasAttribute('aria-current'))).toBe(false)
  })
})
