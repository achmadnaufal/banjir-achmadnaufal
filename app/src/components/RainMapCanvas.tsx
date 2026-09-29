import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { PESANGGRAHAN } from '../config/station'
import { RAIN_RENDER_SIZE, UPSTREAM_OF_LAT } from '../config/forecast'
import type { ResolvedTheme } from '../hooks/useTheme'
import type { RainFrame, RainGrid } from '../lib/rainForecast'
import { colorize, lerpFrames, upsample } from '../lib/rainImage'
import { RainCanvasLayer } from './rainCanvasLayer'

// Standard OSM tiles: keyless, same provider the old embedded map used.
// Dark mode is a CSS filter on the tile pane (see .rain-map-dark in index.css).
const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Rain: <a href="https://open-meteo.com/">Open-Meteo</a>'

const UPSTREAM_STYLE: L.PathOptions = {
  color: '#3b82f6',
  weight: 1,
  dashArray: '4 4',
  fillOpacity: 0.04,
  interactive: false,
}

type Props = {
  grid: RainGrid
  frames: readonly RainFrame[]
  /** Fractional frame index; 2.5 blends hour 2 and hour 3 evenly. */
  position: number
  theme: ResolvedTheme
  gateLabel: string
}

function toLatLngBounds(b: RainGrid['bounds']): L.LatLngBounds {
  return L.latLngBounds([b.south, b.west], [b.north, b.east])
}

/**
 * Upsample each hour once per fetch. Blending two upsampled hours per tick is
 * then a cheap per-pixel lerp — both steps are linear, so the order is free.
 */
function upsampleFrames(frames: readonly RainFrame[], grid: RainGrid): number[][] {
  return frames.map((f) => upsample(f.mm, grid.rows, grid.cols, RAIN_RENDER_SIZE, RAIN_RENDER_SIZE))
}

export default function RainMapCanvas({ grid, frames, position, theme, gateLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const rainRef = useRef<RainCanvasLayer | null>(null)
  const gateRef = useRef<L.CircleMarker | null>(null)

  const fields = useMemo(() => upsampleFrames(frames, grid), [frames, grid])

  // Map, gate marker and upstream outline: created once per grid.
  useEffect(() => {
    if (!containerRef.current) return
    const touch = L.Browser.mobile
    const map = L.map(containerRef.current, {
      // A one-finger drag on a phone should scroll the page, not the map.
      dragging: !touch,
      scrollWheelZoom: false,
      attributionControl: true,
      // Whole-number zoom leaves the forecast area floating in empty map.
      zoomSnap: 0.25,
    }).fitBounds(toLatLngBounds(grid.bounds), { padding: [8, 8] })

    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 16 }).addTo(map)

    rainRef.current = new RainCanvasLayer(
      toLatLngBounds(grid.bounds),
      RAIN_RENDER_SIZE,
      RAIN_RENDER_SIZE,
    ).addTo(map)

    L.rectangle(
      [
        [grid.bounds.south, grid.bounds.west],
        [UPSTREAM_OF_LAT, grid.bounds.east],
      ],
      UPSTREAM_STYLE,
    ).addTo(map)

    gateRef.current = L.circleMarker([PESANGGRAHAN.lat, PESANGGRAHAN.lng], {
      radius: 6,
      color: '#ffffff',
      weight: 2,
      fillColor: '#0b0b0b',
      fillOpacity: 1,
    })
      .bindTooltip(PESANGGRAHAN.name)
      .addTo(map)

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      rainRef.current = null
      gateRef.current = null
    }
  }, [grid])

  // Language switch only relabels the marker; rebuilding the map would blank
  // the rain canvas until the next playback tick.
  useEffect(() => {
    gateRef.current?.setTooltipContent(`${gateLabel}: ${PESANGGRAHAN.name}`)
  }, [gateLabel])

  // Repaint the rain canvas in place for every playback tick.
  useEffect(() => {
    const layer = rainRef.current
    if (!layer) return
    if (fields.length === 0) {
      layer.draw(new Uint8ClampedArray(RAIN_RENDER_SIZE * RAIN_RENDER_SIZE * 4))
      return
    }
    const i0 = Math.min(Math.floor(position), fields.length - 1)
    const i1 = Math.min(i0 + 1, fields.length - 1)
    layer.draw(colorize(lerpFrames(fields[i0], fields[i1], position - i0)))
  }, [fields, position])

  // Leaflet owns the inner div's classes; the theme class lives on the wrapper
  // so a re-render never strips them.
  return (
    <div className={theme === 'dark' ? 'rain-map-dark' : undefined}>
      <div ref={containerRef} className="isolate aspect-[4/3] w-full border-t border-hairline" />
    </div>
  )
}
