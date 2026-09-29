import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import { PESANGGRAHAN } from '../config/station'
import { FRAME_INTERVAL_MS, UPSTREAM_OF_LAT } from '../config/forecast'
import { RAIN_GRID, useRainForecast } from '../hooks/useRainForecast'
import type { ResolvedTheme } from '../hooks/useTheme'
import { formatClock } from '../lib/format'
import { RAIN_SCALE } from '../lib/rainColor'
import { upstreamMask, upstreamSummary, type RainFrame } from '../lib/rainForecast'

// Leaflet is the second-heaviest dependency after Recharts and sits at the
// bottom of the page — keep it out of the first paint, like the chart.
const RainMapCanvas = lazy(() => import('./RainMapCanvas'))

const GOOGLE_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${PESANGGRAHAN.lat},${PESANGGRAHAN.lng}`
const UPSTREAM_MASK = upstreamMask(RAIN_GRID, UPSTREAM_OF_LAT)

const LEGEND_GRADIENT = `linear-gradient(to right, ${RAIN_SCALE.map(
  ({ rgba: [r, g, b] }) => `rgb(${r} ${g} ${b})`,
).join(', ')})`

function MapPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center border-t border-hairline text-sm text-ink-3">
      {children}
    </div>
  )
}

function usePlayback(frameCount: number) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing || frameCount < 2) return
    const id = setInterval(() => setIndex((i) => (i + 1) % frameCount), FRAME_INTERVAL_MS)
    return () => clearInterval(id)
  }, [playing, frameCount])

  // A refetch can return fewer frames than before; never point past the end.
  const safeIndex = frameCount === 0 ? 0 : Math.min(index, frameCount - 1)
  return { index: safeIndex, setIndex, playing, setPlaying }
}

function UpstreamLine({ frames }: { frames: readonly RainFrame[] }) {
  const { t, tag } = useI18n()
  const summary = useMemo(() => upstreamSummary(frames, UPSTREAM_MASK), [frames])
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

function Controls({ frames, playback }: { frames: readonly RainFrame[]; playback: ReturnType<typeof usePlayback> }) {
  const { t, tag } = useI18n()
  const frame = frames[playback.index]
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
        step={1}
        value={playback.index}
        aria-label={t.rainSlider}
        aria-valuetext={frame ? t.rainFrame(formatClock(frame.startsAt, tag), formatClock(frame.endsAt, tag)) : undefined}
        onChange={(e) => {
          playback.setPlaying(false)
          playback.setIndex(Number(e.target.value))
        }}
        className="min-w-0 flex-1 accent-ink"
      />
      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-ink-2">
        {frame && t.rainFrame(formatClock(frame.startsAt, tag), formatClock(frame.endsAt, tag))}
      </span>
    </div>
  )
}

function Legend() {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-2 text-[11px] text-ink-3">
      <span>{t.rainLegendLight}</span>
      <span className="h-1.5 flex-1 rounded-full" style={{ background: LEGEND_GRADIENT }} />
      <span>{t.rainLegendHeavy}</span>
    </div>
  )
}

export function Map({ theme }: { theme: ResolvedTheme }) {
  const { t } = useI18n()
  const forecast = useRainForecast()
  const frames = forecast.frames ?? []
  const playback = usePlayback(frames.length)

  return (
    <section className="overflow-hidden rounded-xl bg-surface" aria-label={t.mapRegion}>
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
          grid={RAIN_GRID}
          frames={frames}
          frameIndex={playback.index}
          theme={theme}
          gateLabel={t.rainGate}
        />
      </Suspense>

      <div className="space-y-3 px-4 py-3">
        {forecast.error && frames.length === 0 ? (
          <p className="text-sm text-ink-3">{t.rainFailed(forecast.error.message)}</p>
        ) : frames.length === 0 ? (
          <p className="text-sm text-ink-3">{t.rainLoading}</p>
        ) : (
          <>
            <Controls frames={frames} playback={playback} />
            <UpstreamLine frames={frames} />
          </>
        )}
        <Legend />
        <p className="text-[11px] leading-snug text-ink-3">{t.rainSource}</p>
      </div>
    </section>
  )
}
