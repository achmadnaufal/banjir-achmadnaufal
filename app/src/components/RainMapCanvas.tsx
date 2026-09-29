import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { PESANGGRAHAN } from '../config/station'
import {
  DETAIL_FADE_DEG,
  FOCUS_BOUNDS,
  RAIN_BLUR_DEG,
  RAIN_RENDER_PX_PER_DEG,
  UPSTREAM_BOUNDS,
  type LatLngBounds,
} from '../config/forecast'
import type { ResolvedTheme } from '../hooks/useTheme'
import { composeField, type CompositeFrame } from '../lib/rainComposite'
import type { RainGrid } from '../lib/rainForecast'
import { colorize, gaussianBlur, lerpFrames } from '../lib/rainImage'
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
  regionGrid: RainGrid
  detailGrid: RainGrid
  frames: readonly CompositeFrame[]
  /** Fractional frame index; 2.5 blends hour 2 and hour 3 evenly. */
  position: number
  theme: ResolvedTheme
  gateLabel: string
}

function toLatLngBounds(b: LatLngBounds): L.LatLngBounds {
  return L.latLngBounds([b.south, b.west], [b.north, b.east])
}

function renderSize(grid: RainGrid) {
  const b = grid.bounds
  return {
    width: Math.round((b.east - b.west) * RAIN_RENDER_PX_PER_DEG),
    height: Math.round((b.north - b.south) * RAIN_RENDER_PX_PER_DEG),
  }
}

/**
 * Merge region + detail into one field per hour, once per fetch. Blending two
 * merged hours per tick is then a cheap per-pixel lerp — every step is
 * linear, so the order doesn't change the result.
 */
function composeFrames(frames: readonly CompositeFrame[], regionGrid: RainGrid, detailGrid: RainGrid): number[][] {
  const { width, height } = renderSize(regionGrid)
  const noRegion = regionGrid.points.map(() => Number.NaN)
  const sigmaPx = RAIN_BLUR_DEG * RAIN_RENDER_PX_PER_DEG
  return frames.map((f) =>
    gaussianBlur(
      composeField(
        { grid: regionGrid, mm: f.region ?? noRegion },
        f.detail ? { grid: detailGrid, mm: f.detail } : null,
        width,
        height,
        DETAIL_FADE_DEG,
      ),
      width,
      height,
      sigmaPx,
    ),
  )
}

export default function RainMapCanvas({ regionGrid, detailGrid, frames, position, theme, gateLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const rainRef = useRef<RainCanvasLayer | null>(null)
  const gateRef = useRef<L.CircleMarker | null>(null)

  const fields = useMemo(() => composeFrames(frames, regionGrid, detailGrid), [frames, regionGrid, detailGrid])

  // Map, rain canvas, gate marker and upstream outline: created once per grid.
  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, {
      // Panning is the point: the forecast covers the whole region while the
      // map opens on the gate. The wheel stays off so desktop page scrolling
      // doesn't zoom the map by accident.
      dragging: true,
      scrollWheelZoom: false,
      attributionControl: true,
      // Whole-number zoom leaves the forecast area floating in empty map.
      zoomSnap: 0.25,
    }).fitBounds(toLatLngBounds(FOCUS_BOUNDS), { padding: [8, 8] })

    L.tileLayer(TILE_URL, { attribution: ATTRIBUTION, maxZoom: 16 }).addTo(map)

    const { width, height } = renderSize(regionGrid)
    rainRef.current = new RainCanvasLayer(toLatLngBounds(regionGrid.bounds), width, height).addTo(map)

    L.rectangle(toLatLngBounds(UPSTREAM_BOUNDS), UPSTREAM_STYLE).addTo(map)

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
  }, [regionGrid])

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
      const { width, height } = renderSize(regionGrid)
      layer.draw(new Uint8ClampedArray(width * height * 4))
      return
    }
    const i0 = Math.min(Math.floor(position), fields.length - 1)
    const i1 = Math.min(i0 + 1, fields.length - 1)
    layer.draw(colorize(lerpFrames(fields[i0], fields[i1], position - i0)))
  }, [fields, position, regionGrid])

  // Leaflet owns the inner div's classes; the theme class lives on the wrapper
  // so a re-render never strips them.
  return (
    <div className={theme === 'dark' ? 'rain-map-dark' : undefined}>
      <div ref={containerRef} className="isolate aspect-[4/3] w-full border-t border-hairline" />
    </div>
  )
}
