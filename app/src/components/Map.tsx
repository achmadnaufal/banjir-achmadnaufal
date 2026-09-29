import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { PESANGGRAHAN } from '../config/station'
import { UPSTREAM_BOUNDS, UPSTREAM_SAMPLE_COLS, UPSTREAM_SAMPLE_ROWS } from '../config/forecast'
import { DETAIL_GRID, REGION_GRID, useRainForecast } from '../hooks/useRainForecast'
import { useRainPlayback, type RainPlayback } from '../hooks/useRainPlayback'
import type { ResolvedTheme } from '../hooks/useTheme'
import { formatClock } from '../lib/format'
import { RAIN_STOPS } from '../lib/rainColor'
import { alignFrames } from '../lib/rainComposite'
import { buildGrid, upstreamSummary, type RainFrame, type RainGrid } from '../lib/rainForecast'

// Leaflet is the second-heaviest dependency after Recharts and sits at the
// bottom of the page — keep it out of the first paint, like the chart.
const RainMapCanvas = lazy(() => import('./RainMapCanvas'))

const GOOGLE_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${PESANGGRAHAN.lat},${PESANGGRAHAN.lng}`
const UPSTREAM_POINTS = buildGrid(UPSTREAM_BOUNDS, UPSTREAM_SAMPLE_ROWS, UPSTREAM_SAMPLE_COLS).points

/**
 * Where each stop sits on the legend bar. The four classes get equal
 * quarters — light up to 5 mm/h, moderate to 10, heavy to 20, extreme beyond —
 * so the labels line up under their colours instead of bunching to one side.
 */
const LEGEND_POSITION: Record<number, number> = { 0.5: 0, 2: 12, 5: 25, 10: 50, 20: 75, 40: 100 }

const LEGEND_GRADIENT = `linear-gradient(to right, ${RAIN_STOPS.filter((s) => s.mm in LEGEND_POSITION)
  .map(({ mm, rgba: [r, g, b] }) => `rgb(${r} ${g} ${b}) ${LEGEND_POSITION[mm]}%`)
  .join(', ')})`

const HOUR_MS = 60 * 60 * 1000
/** Label granularity while playing: whole 10 minutes, so the text doesn't flicker. */
const LABEL_STEP_MS = 10 * 60 * 1000

function MapPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center border-t border-hairline text-sm text-ink-3">
      {children}
    </div>
  )
}

/** True while the element is on screen; assumes visible where unsupported. */
function useInView<T extends Element>() {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver !== 'function') return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, inView }
}

/** Wall-clock time at a fractional frame position, snapped to 10 minutes. */
function timeAt(frames: readonly { startsAt: Date }[], position: number): Date {
  const ms = frames[0].startsAt.getTime() + position * HOUR_MS
  return new Date(Math.round(ms / LABEL_STEP_MS) * LABEL_STEP_MS)
}

function UpstreamLine({ frames, grid }: { frames: readonly RainFrame[]; grid: RainGrid }) {
  const { t, tag } = useI18n()
  const summary = useMemo(() => upstreamSummary(frames, grid, UPSTREAM_POINTS), [frames, grid])
  if (summary.totalMm < 0.1) {
    return <p className="text-sm text-ink-2">{t.rainUpstreamDry}</p>
  }
  const peak = summary.peak
  return (
    <p className="text-sm">
      <span className="font-medium">{t.rainUpstreamTotal(summary.totalMm.toFixed(1))}</span>
      {peak && (
        <span className="text-ink-2">
          {' — '}
          {t.rainUpstreamPeak(formatClock(frames[peak.frameIndex].startsAt, tag), peak.mm.toFixed(1))}
        </span>
      )}
    </p>
  )
}

function Controls({ frames, playback }: { frames: readonly { startsAt: Date }[]; playback: RainPlayback }) {
  const { t, tag } = useI18n()
  const label = t.rainFrame(formatClock(timeAt(frames, playback.position), tag))
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => playback.setPlaying(!playback.playing)}
        aria-pressed={playback.playing}
        className="min-h-10 min-w-16 shrink-0 rounded-lg bg-ink px-3 text-sm font-medium text-plane hover:opacity-90"
      >
        {playback.playing ? t.rainPause : t.rainPlay}
      </button>
      <input
        type="range"
        min={0}
        max={frames.length - 1}
        step="any"
        value={playback.position}
        aria-label={t.rainSlider}
        aria-valuetext={label}
        onChange={(e) => playback.seek(Number(e.target.value))}
        className="min-w-0 flex-1 accent-ink"
      />
      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-ink-2">{label}</span>
    </div>
  )
}

function Legend() {
  const { t } = useI18n()
  return (
    <div className="space-y-1 text-[11px] text-ink-3">
      <div className="h-1.5 rounded-full" style={{ background: LEGEND_GRADIENT }} />
      <div className="grid grid-cols-4 text-center">
        {t.rainLegendClasses.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
    </div>
  )
}

export function Map({ theme }: { theme: ResolvedTheme }) {
  const { t } = useI18n()
  const region = useRainForecast('banjir:rain:region', REGION_GRID)
  const detail = useRainForecast('banjir:rain:detail', DETAIL_GRID)
  const frames = useMemo(() => alignFrames(region.frames, detail.frames), [region.frames, detail.frames])
  // The catchment sits inside the detail grid; use it when it loaded.
  const upstream = detail.frames
    ? { frames: detail.frames, grid: DETAIL_GRID }
    : region.frames
      ? { frames: region.frames, grid: REGION_GRID }
      : null
  const error = region.error ?? detail.error
  const { ref: sectionRef, inView } = useInView<HTMLElement>()
  const playback = useRainPlayback(frames.length, inView)

  return (
    <section ref={sectionRef} className="overflow-hidden rounded-xl bg-surface" aria-label={t.mapRegion}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h2 className="label">{t.rainHeading}</h2>
          <p className="mt-1 truncate text-sm font-medium">{PESANGGRAHAN.name}</p>
        </div>
        <a
          href={GOOGLE_MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
        >
          {t.mapOpen}
        </a>
      </div>

      <Suspense fallback={<MapPlaceholder>{t.rainLoading}</MapPlaceholder>}>
        <RainMapCanvas
          regionGrid={REGION_GRID}
          detailGrid={DETAIL_GRID}
          frames={frames}
          position={playback.position}
          theme={theme}
          gateLabel={t.rainGate}
        />
      </Suspense>

      <div className="space-y-3 px-4 py-3">
        {error && frames.length === 0 ? (
          <p className="text-sm text-ink-3">{t.rainFailed(error.message)}</p>
        ) : frames.length === 0 ? (
          <p className="text-sm text-ink-3">{t.rainLoading}</p>
        ) : (
          <>
            <Controls frames={frames} playback={playback} />
            {upstream && <UpstreamLine frames={upstream.frames} grid={upstream.grid} />}
          </>
        )}
        <Legend />
        <p className="text-[11px] leading-snug text-ink-3">{t.rainSource}</p>
      </div>
    </section>
  )
}
