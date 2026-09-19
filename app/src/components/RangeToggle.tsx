import type { Range } from '../hooks/useHistory'

const OPTIONS: { value: Range; label: string }[] = [
  { value: '6h', label: '6j' },
  { value: '12h', label: '12j' },
  { value: '24h', label: '24j' },
  { value: '7d', label: '7h' },
  { value: '30d', label: '30h' },
  { value: '60d', label: '60h' },
]

type Props = {
  value: Range
  onChange: (next: Range) => void
}

export function RangeToggle({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="label shrink-0" id="range-label">
        Rentang
      </span>
      <div
        role="group"
        aria-labelledby="range-label"
        className="flex flex-1 gap-0.5 rounded-lg bg-sunken p-0.5"
      >
        {OPTIONS.map((opt) => {
          const active = opt.value === value
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.value)}
              // 24px minimum hit target, and the row splits the width evenly
              // so the controls stay thumb-sized on a phone.
              className={`min-h-9 flex-1 rounded-[6px] px-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                  : 'text-ink-3 hover:text-ink-2'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
