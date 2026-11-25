import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// The evening of 2026-11-21: gate 160 had dropped out of xmldata.xml and its
// time-series had been silent since 18 Nov, while BPBD still listed hourly
// manual readings (the numbers JAKI showed).
const BPBD = readFileSync(resolve(__dirname, 'test/fixtures/bpbd-charttma.json'), 'utf8')
const XML_WITHOUT_160 = `<?xml version="1.0"?><root><SP_GET_LAST_STATUS_PINTU_AIR>
<ID_PINTU_AIR>155</ID_PINTU_AIR><NAMA_PINTU_AIR>Bendung. Cibalok - Gadog 1</NAMA_PINTU_AIR>
<LOKASI>Ciliwung</LOKASI><LATITUDE>-6.65</LATITUDE><LONGITUDE>106.87</LONGITUDE>
<SIAGA1>2100</SIAGA1><SIAGA2>1600</SIAGA2><SIAGA3>900</SIAGA3>
<TANGGAL>2026-11-21T19:40:00+07:00</TANGGAL><TINGGI_AIR>30</TINGGI_AIR>
<TINGGI_AIR_SEBELUMNYA>37</TINGGI_AIR_SEBELUMNYA><STATUS_SIAGA>Status : Normal</STATUS_SIAGA>
</SP_GET_LAST_STATUS_PINTU_AIR></root>`
const STALE_HISTORY = '2026-11-18 10.20.00,60;2026-11-18 10.30.00,60|3500;2500;1500'

function respond(body: string): Response {
  return { ok: true, status: 200, text: async () => body } as Response
}

describe('App with the sensor feed silent', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-21T19:55:00+07:00'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = String(url)
        if (u.includes('bpbd.jakarta.go.id')) return respond(BPBD)
        if (u.includes('xmldata')) return respond(XML_WITHOUT_160)
        return respond(STALE_HISTORY)
      }),
    )
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('shows the BPBD hourly reading and says where it came from', async () => {
    render(<App />)
    const hero = await screen.findByTestId('hero-level')
    expect(hero).toHaveTextContent('200')
    // 200 cm is past the 150 cm band -> WASPADA (Siaga III).
    expect(screen.getByRole('status')).toHaveTextContent('WASPADA')
    expect(screen.getByText(/manual gauge reading via BPBD DKI/i)).toBeInTheDocument()
    // 55 minutes old is normal for an hourly table, not "stale".
    expect(screen.queryByText('stale data')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'bpbd.jakarta.go.id' })).toBeInTheDocument()
  })

  it('reads the rise from the last three hourly readings, measured from the reading', async () => {
    render(<App />)
    await screen.findByTestId('hero-level')
    // 17:00 170, 18:00 190, 19:00 200 -> least-squares slope of 15 cm/h.
    // A 60-minute window back from now holds only the 19:00 reading and
    // reports nothing, which the forecast tile used to show as "steady".
    expect(screen.getByText('2-hour rate')).toBeInTheDocument()
    expect(screen.getByText(/\+15\.0/)).toBeInTheDocument()
    expect(screen.queryByText('steady')).not.toBeInTheDocument()
    // 50 cm to SIAGA at 15 cm/h is 200 min from 19:00, so 145 min from 19:55.
    expect(screen.getByText('2h 25m')).toBeInTheDocument()
  })

  it('does not sound a rising alert again on the next visit', async () => {
    // A phone that last saw the sensor at 60 cm on 18 Nov keeps that snapshot
    // cached forever, since the XML never lists gate 160 again. Without the
    // BPBD table cached too, every open re-ran 60 cm -> 200 cm as a "rise".
    const notify = vi.fn()
    vi.stubGlobal(
      'Notification',
      Object.assign(notify, { permission: 'granted', requestPermission: vi.fn() }),
    )
    localStorage.setItem(
      'banjir:lastSnapshot:160',
      JSON.stringify({
        observedAtIso: '2026-11-18T03:30:00.000Z',
        levelCm: 60,
        prevLevelCm: 60,
        thresholdsCm: { siaga1: 350, siaga2: 250, siaga3: 150 },
        statusText: '',
      }),
    )
    const settle = () => act(async () => new Promise((r) => setTimeout(r, 50)))

    const first = render(<App />)
    await screen.findByText(/manual gauge reading via BPBD DKI/i)
    await settle()
    first.unmount()
    notify.mockClear()

    render(<App />)
    await screen.findByText(/manual gauge reading via BPBD DKI/i)
    await settle()
    expect(notify).not.toHaveBeenCalled()
  })
})

// 2026-11-25: gate 160 is back in DSDA's feed, but hourly at irregular minutes.
const XML_HOURLY_160 = `<?xml version="1.0"?><root><SP_GET_LAST_STATUS_PINTU_AIR>
<ID_PINTU_AIR>160</ID_PINTU_AIR><NAMA_PINTU_AIR>P.S. Pesanggrahan 1</NAMA_PINTU_AIR>
<LOKASI>Pesanggrahan</LOKASI><LATITUDE>-6.39</LATITUDE><LONGITUDE>106.77</LONGITUDE>
<SIAGA1>3500</SIAGA1><SIAGA2>2500</SIAGA2><SIAGA3>1500</SIAGA3>
<TANGGAL>2026-11-25T19:09:00+07:00</TANGGAL><TINGGI_AIR>1900</TINGGI_AIR>
<TINGGI_AIR_SEBELUMNYA>1300</TINGGI_AIR_SEBELUMNYA><STATUS_SIAGA>Status : Siaga 3</STATUS_SIAGA>
</SP_GET_LAST_STATUS_PINTU_AIR></root>`
const HOURLY_SERIES =
  '2026-11-25 15.00.00,90;2026-11-25 16.00.00,100;2026-11-25 16.00.00,100;2026-11-25 17.13.00,130;' +
  '2026-11-25 18.19.00,130;2026-11-25 18.19.00,130;2026-11-25 19.09.00,190|3500;2500;1500'
const EMPTY_BPBD = JSON.stringify({ time: '', ketinggian: '', siaga1: '', siaga2: '', siaga3: '' })

describe('App with an hourly DSDA series', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-25T19:40:00+07:00'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const u = String(url)
        if (u.includes('bpbd.jakarta.go.id')) return respond(EMPTY_BPBD)
        if (u.includes('xmldata')) return respond(XML_HOURLY_160)
        return respond(HOURLY_SERIES)
      }),
    )
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('treats a 31-minute-old hourly reading as current, and reads its rise over two hours', async () => {
    render(<App />)
    const hero = await screen.findByTestId('hero-level')
    expect(hero).toHaveTextContent('190')
    // The 20-minute rule for 10-minute data called this "stale".
    expect(screen.queryByText('stale data')).not.toBeInTheDocument()
    expect(await screen.findByText('2-hour rate')).toBeInTheDocument()
    expect(screen.getByText(/\+\d+\.\d cm\/h/)).toBeInTheDocument()
    expect(screen.queryByText('steady')).not.toBeInTheDocument()
  })
})
