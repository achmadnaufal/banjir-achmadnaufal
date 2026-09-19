import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const XML = `<?xml version="1.0"?><root><SP_GET_LAST_STATUS_PINTU_AIR>
<ID_PINTU_AIR>160</ID_PINTU_AIR><NAMA_PINTU_AIR>P.S. Pesanggrahan 1</NAMA_PINTU_AIR>
<LOKASI>x</LOKASI><LATITUDE>-6.39</LATITUDE><LONGITUDE>106.77</LONGITUDE>
<SIAGA1>3500</SIAGA1><SIAGA2>2500</SIAGA2><SIAGA3>1500</SIAGA3>
<TANGGAL>2026-09-19 10:00:00</TANGGAL><TINGGI_AIR>2800</TINGGI_AIR>
<TINGGI_AIR_SEBELUMNYA>2700</TINGGI_AIR_SEBELUMNYA><STATUS_SIAGA>Siaga 2</STATUS_SIAGA>
</SP_GET_LAST_STATUS_PINTU_AIR></root>`
const HISTORY = '2026-09-19 09.00.00,270;2026-09-19 09.30.00,280|3500;2500;1500'

describe('App smoke', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true, status: 200,
      text: async () => (String(url).includes('xmldata') ? XML : HISTORY),
    } as Response)))
  })
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear() })

  it('shows the level, the official band name and the legend', async () => {
    render(<App />)
    const hero = await screen.findByTestId('hero-level')
    expect(hero).toHaveTextContent('280')
    expect(screen.getByText('2.80 m')).toBeInTheDocument()
    // 280cm sits in the 250-350 band -> SIAGA per the official legend.
    expect(screen.getByRole('status')).toHaveTextContent('SIAGA')
    const legend = screen.getByRole('region', { name: /keterangan/i })
    expect(legend).toHaveTextContent('> 350 cm')
    expect(legend).toHaveTextContent('BAHAYA')
    expect(screen.queryByText(/Terjadi kesalahan/i)).not.toBeInTheDocument()
  })

  it('marks the current band in the legend', async () => {
    render(<App />)
    await screen.findByTestId('hero-level')
    const legend = screen.getByRole('region', { name: /keterangan/i })
    const current = legend.querySelector('[aria-current="true"]')
    expect(current).toHaveTextContent('SIAGA')
    expect(current).toHaveTextContent('250 - 350 cm')
  })
})
