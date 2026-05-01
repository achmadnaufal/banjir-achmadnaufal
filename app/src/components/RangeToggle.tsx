import type { Range } from '../hooks/useHistory'

const OPTIONS: { value: Range; label: string }[] = [
  { value: '6h', label: '6h' },
  { value: '12h', label: '12h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '60d', label: '60d' },
]

type Props = {
  value: Range
  onChange: (next: Range) => void
}

export function RangeToggle({ value, onChange }: Props) {
  return (
    <div role="tablist" aria-label="Time range" className="flex flex-wrap gap-1 rounded-lg bg-zinc-200 p-1 dark:bg-zinc-800">
      {OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`min-w-9 rounded-md px-2 py-1 text-xs font-medium transition-colors sm:min-w-11 sm:px-2.5 sm:py-1.5 sm:text-sm ${
              active
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
                : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
