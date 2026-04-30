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
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-zinc-900" aria-label="Station location">
      <iframe
        title={`Map showing ${PESANGGRAHAN.name}`}
        src={OSM_URL}
        className="aspect-square w-full border-0 sm:aspect-video"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <a
        href={GOOGLE_MAPS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block px-4 py-3 text-center text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Open in Google Maps →
      </a>
    </section>
  )
}
