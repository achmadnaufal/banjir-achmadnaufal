import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KeteranganLegend } from './KeteranganLegend'
import type { ThresholdsCm } from '../types/upstream'

const T: ThresholdsCm = { siaga1: 350, siaga2: 250, siaga3: 150 }

function rows() {
  return within(screen.getByRole('region', { name: /keterangan/i })).getAllByRole('listitem')
}

describe('KeteranganLegend', () => {
  it('renders the four official bands highest-first', () => {
    render(<KeteranganLegend thresholdsCm={T} />)
    expect(rows().map((li) => li.textContent)).toEqual([
      '> 350 cmBAHAYA',
      '250 - 350 cmSIAGA',
      '150 - 250 cmWASPADA',
      '< 150 cmNORMAL',
    ])
  })

  it('reflects upstream thresholds rather than the hardcoded fallback', () => {
    render(<KeteranganLegend thresholdsCm={{ siaga1: 400, siaga2: 300, siaga3: 200 }} />)
    expect(screen.getByText('> 400 cm')).toBeInTheDocument()
    expect(screen.getByText('< 200 cm')).toBeInTheDocument()
  })

  it('marks the current band and only that one', () => {
    render(<KeteranganLegend thresholdsCm={T} currentLevel="siaga3" />)
    const marked = rows().filter((li) => li.getAttribute('aria-current') === 'true')
    expect(marked).toHaveLength(1)
    expect(marked[0]).toHaveTextContent('WASPADA')
  })

  it('marks nothing before the first reading arrives', () => {
    render(<KeteranganLegend thresholdsCm={T} currentLevel={null} />)
    expect(rows().some((li) => li.hasAttribute('aria-current'))).toBe(false)
  })
})
