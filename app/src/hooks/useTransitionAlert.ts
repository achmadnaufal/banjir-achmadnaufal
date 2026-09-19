import { useCallback, useEffect, useRef, useState } from 'react'
import { detectTransition, siagaMeta, type SiagaLevel } from '../lib/siaga'
import { formatLevel } from '../lib/format'

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

function readPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return window.Notification.permission as NotificationPermissionState
}

export type UseTransitionAlertResult = {
  permission: NotificationPermissionState
  requestPermission: () => Promise<NotificationPermissionState>
  testChime: () => void
}

type AudioWindow = Window & {
  AudioContext?: typeof AudioContext
  webkitAudioContext?: typeof AudioContext
}

function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const w = window as AudioWindow
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

export type AlertCopy = {
  title: (band: string, level: string) => string
  body: string
}

export function useTransitionAlert(
  currentLevel: SiagaLevel | null,
  currentCm: number | null,
  copy: AlertCopy,
): UseTransitionAlertResult {
  const [permission, setPermission] = useState<NotificationPermissionState>(() => readPermission())
  const prevRef = useRef<SiagaLevel | null>(null)
  // Held in a ref so switching language never re-runs the transition effect
  // (which would risk a duplicate chime).
  const copyRef = useRef(copy)
  useEffect(() => {
    copyRef.current = copy
  }, [copy])
  const audioCtxRef = useRef<AudioContext | null>(null)

  const playChime = useCallback(() => {
    const Ctor = getAudioContextCtor()
    if (!Ctor) return
    if (!audioCtxRef.current) audioCtxRef.current = new Ctor()
    const ctx = audioCtxRef.current
    const start = ctx.currentTime
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()
    osc1.type = 'sine'
    osc2.type = 'sine'
    osc1.frequency.value = 880
    osc2.frequency.value = 1320
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6)
    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(ctx.destination)
    osc1.start(start)
    osc2.start(start + 0.18)
    osc1.stop(start + 0.6)
    osc2.stop(start + 0.6)
  }, [])

  const requestPermission = useCallback(async (): Promise<NotificationPermissionState> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    const result = await window.Notification.requestPermission()
    setPermission(result as NotificationPermissionState)
    return result as NotificationPermissionState
  }, [])

  useEffect(() => {
    if (currentLevel === null) return
    const prev = prevRef.current
    const transition = detectTransition(prev, currentLevel)
    prevRef.current = currentLevel
    if (!transition.changed || transition.direction !== 'rising') return

    playChime()

    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (window.Notification.permission !== 'granted') return

    const meta = siagaMeta(currentLevel)
    const levelStr = currentCm === null ? '' : formatLevel(currentCm)
    try {
      new window.Notification(copyRef.current.title(meta.label, levelStr), {
        body: copyRef.current.body,
        tag: `banjir-${currentLevel}`,
        icon: '/favicon.svg',
      })
    } catch {
      // Notification can throw on some browsers — silently degrade
    }
  }, [currentLevel, currentCm, playChime])

  return { permission, requestPermission, testChime: playChime }
}
