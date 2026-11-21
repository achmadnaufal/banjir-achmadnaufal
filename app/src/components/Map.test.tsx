import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleProvider } from '../i18n/LocaleProvider'
import { Map } from './Map'

const HOUR = 3600

/** Open-Meteo multi-location body: rain everywhere, heaviest in hour 3. */
function forecastBody(nowSec: number, locations: number) {
  const start = nowSec - (nowSec % HOUR)
  const time = Array.from({ length: 13 }, (_, i) => start + i * HOUR)
  const precipitation = time.map((_, i) => (i === 3 ? 8 : 1))
  return Array.from({ length: locations }, () => ({ hourly: { time, precipitation } }))
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
      const nowSec = Math.floor(Date.now() / 1000)
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          // Answer each grid with as many locations as it asked for.
          const count = new URL(url).searchParams.get('latitude')!.split(',').length
          const body = JSON.stringify(forecastBody(nowSec, count))
          return { ok: true, status: 200, text: async () => body } as Response
        }),
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

  it('reuses a fresh cached forecast instead of fetching again', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const fetchMock = vi.fn(async (url: string) => {
      const count = new URL(url).searchParams.get('latitude')!.split(',').length
      const body = JSON.stringify(forecastBody(nowSec, count))
      return { ok: true, status: 200, text: async () => body } as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    const first = renderMap()
    await screen.findByRole('slider', { name: 'Forecast hour' })
    const calls = fetchMock.mock.calls.length
    first.unmount()

    renderMap()
    await screen.findByRole('slider', { name: 'Forecast hour' })
    expect(fetchMock.mock.calls.length).toBe(calls)
  })

  it('explains a broken response without dumping the request URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, text: async () => 'not json' }) as Response),
    )
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderMap()
    expect(await screen.findByText(/forecast service returned an error/i)).toBeInTheDocument()
  })

  describe('when Open-Meteo rate-limits (HTTP 429)', () => {
    const rateLimited = () =>
      vi.fn(async () => ({ ok: false, status: 429, text: async () => '{"error":true}' }) as Response)

    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('says the service is busy, not a wall of URL', async () => {
      vi.stubGlobal('fetch', rateLimited())
      const { container } = renderMap()
      expect(await screen.findByText(/forecast service is busy/i)).toBeInTheDocument()
      expect(container.textContent).not.toContain('api.open-meteo.com')
    })

    it('keeps showing the last saved forecast and says so', async () => {
      // A forecast saved two hours ago, in the cache format the page writes.
      const nowSec = Math.floor(Date.now() / 1000)
      const savedAt = Date.now() - 2 * 3_600_000
      const okFetch = vi.fn(async (url: string) => {
        const count = new URL(url).searchParams.get('latitude')!.split(',').length
        const body = JSON.stringify(forecastBody(nowSec, count))
        return { ok: true, status: 200, text: async () => body } as Response
      })
      vi.stubGlobal('fetch', okFetch)
      const first = renderMap()
      await screen.findByRole('slider', { name: 'Forecast hour' })
      first.unmount()
      for (const key of Object.keys(localStorage)) {
        const entry = JSON.parse(localStorage.getItem(key)!)
        localStorage.setItem(key, JSON.stringify({ ...entry, fetchedAt: savedAt }))
      }

      vi.stubGlobal('fetch', rateLimited())
      renderMap()
      expect(await screen.findByRole('slider', { name: 'Forecast hour' })).toBeInTheDocument()
      expect(await screen.findByText(/last saved forecast/i)).toBeInTheDocument()
    })

    it('retries by itself once the per-minute window has passed', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const fetchMock = rateLimited()
      vi.stubGlobal('fetch', fetchMock)
      renderMap()
      await screen.findByText(/forecast service is busy/i)
      const before = fetchMock.mock.calls.length
      await vi.advanceTimersByTimeAsync(64_000)
      expect(fetchMock.mock.calls.length).toBe(before)
      await vi.advanceTimersByTimeAsync(2_000)
      expect(fetchMock.mock.calls.length).toBeGreaterThan(before)
    })
  })
})
