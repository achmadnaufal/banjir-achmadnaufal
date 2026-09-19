import { PESANGGRAHAN } from '../config/station'

const DELTA = 0.01
const bbox = [
  PESANGGRAHAN.lng - DELTA,
  PESANGGRAHAN.lat - DELTA,
  PESANGGRAHAN.lng + DELTA,
  PESANGGRAHAN.lat + DELTA,
].join(',')

const OSM_URL = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${PESANGGRAHAN.lat},${PESANGGRAHAN.lng}`
const GOOGLE_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${PESANGGRAHAN.lat},${PESANGGRAHAN.lng}`

export function Map() {
  return (
    <section className="overflow-hidden rounded-xl bg-surface" aria-label="Lokasi pos pantau">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h2 className="label">Pos pantau</h2>
          <p className="mt-1 truncate text-sm font-medium">{PESANGGRAHAN.name}</p>
        </div>
        <a
          href={GOOGLE_MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
        >
          Buka di peta →
        </a>
      </div>
      <iframe
        title={`Peta lokasi ${PESANGGRAHAN.name}`}
        src={OSM_URL}
        className="aspect-[16/10] w-full border-0 border-t border-hairline"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </section>
  )
}
