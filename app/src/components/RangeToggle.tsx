import type { Range } from '../hooks/useHistory'

const OPTIONS: { value: Range; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
]

type Props = {
  value: Range
  onChange: (next: Range) => void
}

export function RangeToggle({ value, onChange }: Props) {
  return (
    <div role="tablist" aria-label="Time range" className="inline-flex rounded-lg bg-zinc-200 p-1 dark:bg-zinc-800">
      {OPTIONS.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`min-w-12 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
