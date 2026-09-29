import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../i18n/LocaleProvider'
import { FORECAST_GRID_COLS, FORECAST_GRID_ROWS } from '../config/forecast'
import { Map } from './Map'

const HOUR = 3600
const CELLS = FORECAST_GRID_ROWS * FORECAST_GRID_COLS

/** Open-Meteo multi-location body: rain everywhere, heaviest in hour 3. */
function forecastBody(nowSec: number) {
  const start = nowSec - (nowSec % HOUR)
  const time = Array.from({ length: 13 }, (_, i) => start + i * HOUR)
  const precipitation = time.map((_, i) => (i === 3 ? 8 : 1))
  return Array.from({ length: CELLS }, () => ({ hourly: { time, precipitation } }))
}

function renderMap() {
  return render(
    <LocaleProvider>
      <Map theme="light" />
    </LocaleProvider>,
  )
}

describe('Map (rain forecast)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  describe('with a forecast', () => {
    beforeEach(() => {
      const body = JSON.stringify(forecastBody(Math.floor(Date.now() / 1000)))
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({ ok: true, status: 200, text: async () => body }) as Response),
      )
    })

    it('shows 12 hourly frames and the upstream total', async () => {
      renderMap()
      const slider = await screen.findByRole('slider', { name: 'Forecast hour' })
      expect(slider).toHaveAttribute('max', '11')
      // 11 hours at 1 mm + 1 hour at 8 mm = 19 mm upstream.
      expect(screen.getByText(/Upstream: 19\.0 mm expected/)).toBeInTheDocument()
      expect(screen.getByText(/heaviest around .* \(8\.0 mm\/h\)/)).toBeInTheDocument()
    })

    it('starts playing on its own', async () => {
      renderMap()
      const pause = await screen.findByRole('button', { name: 'Pause' })
      expect(pause).toHaveAttribute('aria-pressed', 'true')
    })

    it('scrubbing takes over from playback and labels the time', async () => {
      const user = userEvent.setup()
      renderMap()
      const slider = await screen.findByRole('slider', { name: 'Forecast hour' })
      await screen.findByRole('button', { name: 'Pause' })
      fireEvent.change(slider, { target: { value: '4' } })
      expect(slider).toHaveValue('4')
      expect(slider.getAttribute('aria-valuetext')).toMatch(/^\d{2}:\d0 WIB$/)
      const play = screen.getByRole('button', { name: 'Play' })
      await user.click(play)
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    })

    it('stays still for readers who asked for reduced motion', async () => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }))
      renderMap()
      await screen.findByRole('slider', { name: 'Forecast hour' })
      // Give autoplay every chance to (wrongly) start.
      await new Promise((r) => setTimeout(r, 50))
      expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('shows the four BMKG intensity classes in the legend', async () => {
      renderMap()
      await screen.findByRole('slider', { name: 'Forecast hour' })
      for (const name of ['Light', 'Moderate', 'Heavy', 'Extreme']) {
        expect(screen.getByText(name)).toBeInTheDocument()
      }
    })
  })

  it('explains when the forecast cannot load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, text: async () => 'not json' }) as Response),
    )
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderMap()
    expect(await screen.findByText(/Rain forecast unavailable/)).toBeInTheDocument()
  })
})
