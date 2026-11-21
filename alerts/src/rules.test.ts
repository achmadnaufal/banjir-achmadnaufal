import { describe, expect, it } from 'vitest'
import type { SiagaLevel } from '../../app/src/lib/siaga'
import { decideAlert, INITIAL_ALERT_STATE, type AlertKind, type AlertState } from './rules'

const at = (hm: string) => new Date(`2026-11-21T${hm}:00+07:00`)
const r = (band: SiagaLevel, hm: string) => ({ band, observedAt: at(hm) })
/** Readings reach the watcher a few minutes after they are taken. */
const arrival = (hm: string) => new Date(at(hm).getTime() + 5 * 60_000)

/** Feeds readings in order and returns what each one pushed. */
function run(readings: Array<[SiagaLevel, string]>, start: AlertState = INITIAL_ALERT_STATE) {
  let state = start
  const pushes: Array<AlertKind | null> = []
  for (const [band, hm] of readings) {
    const d = decideAlert(r(band, hm), state, arrival(hm))
    pushes.push(d.push)
    state = d.next
  }
  return { pushes, state }
}

describe('decideAlert', () => {
  it('stays quiet with no reading', () => {
    expect(decideAlert(null, INITIAL_ALERT_STATE, at('19:00'))).toEqual({
      push: null,
      next: INITIAL_ALERT_STATE,
    })
  })

  it('stays quiet on a reading older than 2 h', () => {
    expect(decideAlert(r('siaga2', '16:00'), INITIAL_ALERT_STATE, at('18:01'))).toEqual({
      push: null,
      next: INITIAL_ALERT_STATE,
    })
  })

  it('ignores a reading it has already seen', () => {
    expect(run([['siaga3', '19:00'], ['siaga3', '19:00']]).pushes).toEqual(['alert', null])
  })

  it('alerts on the first WASPADA reading', () => {
    const d = decideAlert(r('siaga3', '19:00'), INITIAL_ALERT_STATE, arrival('19:00'))
    expect(d.push).toBe('alert')
    expect(d.next).toEqual({
      lastBandAnnounced: 'siaga3',
      lastPushAt: arrival('19:00').getTime(),
      lastPushedReadingAt: at('19:00').getTime(),
      lastSeenReadingAt: at('19:00').getTime(),
      belowCount: 0,
    })
  })

  it('stays quiet on the next reading within the hour', () => {
    const { pushes, state } = run([['siaga3', '19:00'], ['siaga3', '19:50']])
    expect(pushes).toEqual(['alert', null])
    expect(state.lastSeenReadingAt).toBe(at('19:50').getTime())
    expect(state.lastPushedReadingAt).toBe(at('19:00').getTime())
  })

  it('sends the hourly update once a reading is 60 min newer', () => {
    expect(run([['siaga3', '19:00'], ['siaga3', '20:00']]).pushes).toEqual(['alert', 'alert'])
  })

  it('escalates immediately', () => {
    const { pushes, state } = run([['siaga3', '19:00'], ['siaga2', '19:10']])
    expect(pushes).toEqual(['alert', 'escalation'])
    expect(state.lastBandAnnounced).toBe('siaga2')
  })

  it('escalates straight past a band', () => {
    expect(run([['siaga3', '19:00'], ['siaga1', '19:10']]).pushes).toEqual(['alert', 'escalation'])
  })

  it('escalates once on a 249/251 wobble', () => {
    expect(
      run([['siaga3', '19:00'], ['siaga2', '19:10'], ['siaga3', '19:20'], ['siaga2', '19:30']]).pushes,
    ).toEqual(['alert', 'escalation', null, null])
  })

  it('announces a drop within elevated bands at the hourly update', () => {
    const { pushes, state } = run([['siaga2', '19:00'], ['siaga3', '19:30'], ['siaga3', '20:00']])
    expect(pushes).toEqual(['alert', null, 'alert'])
    expect(state.lastBandAnnounced).toBe('siaga3')
  })

  it('waits for two NORMAL readings before the all-clear', () => {
    const { pushes, state } = run([['siaga3', '19:00'], ['normal', '20:00'], ['normal', '21:00']])
    expect(pushes).toEqual(['alert', null, 'allClear'])
    expect(state.lastBandAnnounced).toBe('normal')
    expect(state.belowCount).toBe(0)
  })

  it('does not flap around 150 cm on hourly readings', () => {
    // The third reading is >= 60 min after the last pushed one: an hourly
    // update, not a re-alert. It resets the count toward the all-clear.
    expect(
      run([
        ['siaga3', '19:00'],
        ['normal', '20:00'],
        ['siaga3', '21:00'],
        ['normal', '22:00'],
        ['normal', '23:00'],
      ]).pushes,
    ).toEqual(['alert', null, 'alert', null, 'allClear'])
  })

  it('does not flap around 150 cm on 10-minute sensor readings', () => {
    expect(
      run([
        ['siaga3', '19:00'],
        ['normal', '19:10'],
        ['siaga3', '19:20'],
        ['normal', '19:30'],
        ['siaga3', '19:40'],
      ]).pushes,
    ).toEqual(['alert', null, null, null, null])
  })

  it('never pushes for NORMAL when nothing was announced', () => {
    expect(run([['normal', '19:00'], ['normal', '20:00'], ['normal', '21:00']]).pushes).toEqual([
      null,
      null,
      null,
    ])
  })

  it('stays quiet after the all-clear until the river rises again', () => {
    expect(
      run([['siaga3', '19:00'], ['normal', '20:00'], ['normal', '21:00'], ['normal', '22:00'], ['siaga3', '22:10']])
        .pushes,
    ).toEqual(['alert', null, 'allClear', null, 'alert'])
  })

  it('does not mutate the state it is given', () => {
    const frozen = Object.freeze({ ...INITIAL_ALERT_STATE })
    expect(() => decideAlert(r('siaga3', '19:00'), frozen, arrival('19:00'))).not.toThrow()
    expect(frozen).toEqual(INITIAL_ALERT_STATE)
  })
})
