import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { PESANGGRAHAN } from '../config/station'
import { UPSTREAM_OF_LAT } from '../config/forecast'
import type { ResolvedTheme } from '../hooks/useTheme'
import type { RainFrame, RainGrid } from '../lib/rainForecast'
import { frameToPixels } from '../lib/rainImage'

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
  frameIndex: number
  theme: ResolvedTheme
  gateLabel: string
}

function toLatLngBounds(b: RainGrid['bounds']): L.LatLngBoundsExpression {
  return [
    [b.south, b.west],
    [b.north, b.east],
  ]
}

/** One tiny data-URL image per frame, rendered once per forecast fetch. */
function renderFrames(frames: readonly RainFrame[], grid: RainGrid): string[] {
  const canvas = document.createElement('canvas')
  canvas.width = grid.cols
  canvas.height = grid.rows
  const ctx = canvas.getContext('2d')
  if (!ctx) return frames.map(() => '')
  return frames.map((frame) => {
    const image = new ImageData(frameToPixels(frame.mm, grid.rows, grid.cols), grid.cols, grid.rows)
    ctx.putImageData(image, 0, 0)
    return canvas.toDataURL('image/png')
  })
}

export default function RainMapCanvas({ grid, frames, frameIndex, theme, gateLabel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const overlayRef = useRef<L.ImageOverlay | null>(null)

  const images = useMemo(() => renderFrames(frames, grid), [frames, grid])

  // Map, gate marker and upstream outline: created once.
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

    L.rectangle(
      [
        [grid.bounds.south, grid.bounds.west],
        [UPSTREAM_OF_LAT, grid.bounds.east],
      ],
      UPSTREAM_STYLE,
    ).addTo(map)

    L.circleMarker([PESANGGRAHAN.lat, PESANGGRAHAN.lng], {
      radius: 6,
      color: '#ffffff',
      weight: 2,
      fillColor: '#0b0b0b',
      fillOpacity: 1,
    })
      .bindTooltip(`${gateLabel}: ${PESANGGRAHAN.name}`)
      .addTo(map)

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      overlayRef.current = null
    }
  }, [grid, gateLabel])

  // Rain overlay follows the selected frame.
  useEffect(() => {
    const map = mapRef.current
    const url = images[frameIndex]
    if (!map) return
    if (!url) {
      overlayRef.current?.remove()
      overlayRef.current = null
      return
    }
    if (overlayRef.current) {
      overlayRef.current.setUrl(url)
    } else {
      overlayRef.current = L.imageOverlay(url, toLatLngBounds(grid.bounds), {
        opacity: 0.85,
        interactive: false,
        className: 'rain-overlay',
      }).addTo(map)
    }
  }, [images, frameIndex, grid])

  // Leaflet owns the inner div's classes; the theme class lives on the wrapper
  // so a re-render never strips them.
  return (
    <div className={theme === 'dark' ? 'rain-map-dark' : undefined}>
      <div ref={containerRef} className="isolate aspect-[4/3] w-full border-t border-hairline" />
    </div>
  )
}
