import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PushAlertsState } from '../hooks/usePushAlerts'
import { renderWithLocale } from '../test/render'
import { PushAlerts } from './PushAlerts'

const NOW = new Date('2026-11-21T20:00:00+07:00')
const minutesAgo = (m: number) => NOW.getTime() - m * 60_000

function state(over: Partial<PushAlertsState> = {}): PushAlertsState {
  return {
    view: 'off',
    error: null,
    serviceUnreachable: false,
    service: { lastRunAt: minutesAgo(3), lastRunOk: true, lastReadingAt: minutesAgo(60), lastReadingSource: 'manual', subscribers: 4 },
    enable: vi.fn(async () => undefined),
    disable: vi.fn(async () => undefined),
    sendTest: vi.fn(async () => true),
    ...over,
  }
}

afterEach(() => localStorage.clear())

describe('PushAlerts', () => {
  it('walks an iPhone Safari tab through adding the page to the Home Screen, with no button', () => {
    renderWithLocale(<PushAlerts {...state({ view: 'needs-install' })} now={NOW} />)
    expect(screen.getByText('Get alerts even when this page is closed')).toBeInTheDocument()
    const steps = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(steps).toEqual([
      'In Safari, tap the Share button',
      'Choose “Add to Home Screen”',
      'Open Monitor Banjir from your Home Screen',
      'Tap “Turn on alerts” there',
    ])
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('offers to turn alerts on', async () => {
    const s = state({ view: 'off' })
    renderWithLocale(<PushAlerts {...s} now={NOW} />)
    await userEvent.click(screen.getByRole('button', { name: 'Turn on alerts' }))
    expect(s.enable).toHaveBeenCalled()
  })

  it('shows alerts on, with a test and a way to turn them off', async () => {
    const s = state({ view: 'on' })
    renderWithLocale(<PushAlerts {...s} now={NOW} />)
    expect(screen.getByText('Alerts are on for this phone')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Send test' }))
    expect(s.sendTest).toHaveBeenCalled()
    expect(await screen.findByText('Test sent — check your notifications.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Turn off' }))
    expect(s.disable).toHaveBeenCalled()
  })

  it('explains how to unblock notifications in Settings', () => {
    renderWithLocale(<PushAlerts {...state({ view: 'denied' })} now={NOW} />)
    expect(screen.getByText(/Settings → Notifications → Monitor Banjir/)).toBeInTheDocument()
  })

  it('says when this browser cannot get closed-page alerts', () => {
    renderWithLocale(<PushAlerts {...state({ view: 'unsupported' })} now={NOW} />)
    expect(screen.getByText(/iOS 16.4 or later/)).toBeInTheDocument()
  })

  it('disables the buttons while working', () => {
    renderWithLocale(<PushAlerts {...state({ view: 'working' })} now={NOW} />)
    expect(screen.getByRole('button', { name: 'One moment…' })).toBeDisabled()
  })

  it('says when the alert service last checked the river', () => {
    renderWithLocale(<PushAlerts {...state()} now={NOW} />)
    expect(screen.getByText('Alert service checked 3 min ago')).toBeInTheDocument()
  })

  it.each([
    ['more than 20 min ago', minutesAgo(25)],
    ['never', null],
  ])('warns when the alert service last checked %s', (_label, lastRunAt) => {
    const base = state()
    renderWithLocale(<PushAlerts {...base} service={{ ...base.service!, lastRunAt }} now={NOW} />)
    expect(screen.getByText(/The alert service has not checked/)).toHaveTextContent(
      'The alert service has not checked the river recently — alerts may be delayed.',
    )
  })

  it('warns when the alert service cannot be reached at all', () => {
    renderWithLocale(<PushAlerts {...state({ service: null, serviceUnreachable: true })} now={NOW} />)
    expect(screen.getByText(/The alert service has not checked/)).toHaveTextContent('The alert service has not checked the river recently')
  })

  it('unlocks the in-page chime on every tap', async () => {
    const onGesture = vi.fn()
    renderWithLocale(<PushAlerts {...state({ view: 'off' })} now={NOW} onGesture={onGesture} />)
    await userEvent.click(screen.getByRole('button', { name: 'Turn on alerts' }))
    expect(onGesture).toHaveBeenCalledTimes(1)
  })

  it('shows nothing about the service before its status has loaded', () => {
    renderWithLocale(<PushAlerts {...state({ service: null })} now={NOW} />)
    expect(screen.queryByText(/Alert service/)).not.toBeInTheDocument()
  })

  it('shows an error', () => {
    renderWithLocale(<PushAlerts {...state({ error: 'subscriptions full' })} now={NOW} />)
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't change alerts: subscriptions full")
  })

  it('speaks Indonesian', async () => {
    renderWithLocale(<PushAlerts {...state({ view: 'on' })} now={NOW} />, 'id')
    expect(screen.getByText('Peringatan aktif di ponsel ini')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kirim tes' })).toBeInTheDocument()
    expect(screen.getByText('Layanan peringatan dicek 3 menit lalu')).toBeInTheDocument()
    await act(async () => undefined)
  })
})
