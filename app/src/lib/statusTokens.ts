import type { SiagaLevel } from './siaga'

/**
 * The reserved status scale. These four steps are the only place these hexes
 * appear — a status colour never doubles as a series or decorative colour.
 */
export const STATUS_HEX = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const

export type StatusRole = keyof typeof STATUS_HEX

/** Which ink clears 4.5:1 when laid on a solid chip of the status colour. */
export type ChipInk = 'dark' | 'light'

export type StatusIcon = 'check' | 'alert' | 'alert-fill' | 'siren'

export type StatusToken = {
  role: StatusRole
  hex: string
  chipInk: ChipInk
  icon: StatusIcon
  severity: 0 | 1 | 2 | 3
}

const TOKENS: Record<SiagaLevel, StatusToken> = {
  normal: { role: 'good', hex: STATUS_HEX.good, chipInk: 'dark', icon: 'check', severity: 0 },
  siaga3: { role: 'warning', hex: STATUS_HEX.warning, chipInk: 'dark', icon: 'alert', severity: 1 },
  siaga2: { role: 'serious', hex: STATUS_HEX.serious, chipInk: 'dark', icon: 'alert-fill', severity: 2 },
  siaga1: { role: 'critical', hex: STATUS_HEX.critical, chipInk: 'light', icon: 'siren', severity: 3 },
}

export function statusToken(level: SiagaLevel): StatusToken {
  return TOKENS[level]
}

/** Tailwind class for the token colour, by the role's CSS variable. */
export const STATUS_BG: Record<StatusRole, string> = {
  good: 'bg-good',
  warning: 'bg-warning',
  serious: 'bg-serious',
  critical: 'bg-critical',
}

export const STATUS_TEXT_ON_CHIP: Record<ChipInk, string> = {
  dark: 'text-[#0b0b0b]',
  light: 'text-white',
}
