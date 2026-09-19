import { useI18n } from '../i18n/useI18n'
import type { Messages } from '../i18n/messages'
import type { Range } from '../hooks/useHistory'

const OPTIONS: { value: Range; key: keyof Messages }[] = [
  { value: '6h', key: 'range6h' },
  { value: '12h', key: 'range12h' },
  { value: '24h', key: 'range24h' },
  { value: '7d', key: 'range7d' },
  { value: '30d', key: 'range30d' },
  { value: '60d', key: 'range60d' },
]

type Props = {
  value: Range
  onChange: (next: Range) => void
}

export function RangeToggle({ value, onChange }: Props) {
  const { t } = useI18n()

  return (
    <div className="flex items-center gap-2">
      <span className="label shrink-0" id="range-label">
        {t.rangeLabel}
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
              {t[opt.key] as string}
            </button>
          )
        })}
      </div>
    </div>
  )
}
