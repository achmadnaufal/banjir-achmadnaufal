import { siagaMeta, type SiagaLevel } from '../lib/siaga'
import { STATUS_BG, STATUS_TEXT_ON_CHIP, statusToken } from '../lib/statusTokens'
import { StatusIcon } from './StatusIcon'

type Props = {
  level: SiagaLevel
  size?: 'sm' | 'lg'
}

/**
 * Status is never colour alone — every chip carries its glyph and its name.
 * The ink pairing per chip is measured, not guessed: white clears 4.5:1 only
 * on the critical step; the other three take dark ink.
 */
export function SiagaBadge({ level, size = 'sm' }: Props) {
  const meta = siagaMeta(level)
  const token = statusToken(level)
  const big = size === 'lg'

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-[0.08em] uppercase ${
        STATUS_BG[token.role]
      } ${STATUS_TEXT_ON_CHIP[token.chipInk]} ${
        big ? 'px-3 py-1.5 text-[13px]' : 'px-2.5 py-1 text-[11px]'
      }`}
    >
      <StatusIcon name={token.icon} className={big ? 'size-4' : 'size-3.5'} />
      {meta.label}
    </span>
  )
}
