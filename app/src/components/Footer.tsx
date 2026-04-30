import { timeSince } from '../lib/format'

type Props = {
  lastFetchedAt: Date | null
  now: Date
}

export function Footer({ lastFetchedAt, now }: Props) {
  return (
    <footer className="space-y-1 px-2 py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
      <p>
        Source:{' '}
        <a
          className="underline-offset-2 hover:underline"
          href="https://poskobanjir.dsdadki.web.id"
          target="_blank"
          rel="noopener noreferrer"
        >
          poskobanjir.dsdadki.web.id
        </a>
      </p>
      <p>
        {lastFetchedAt
          ? `Page data fetched ${timeSince(lastFetchedAt, now)}`
          : 'Fetching latest data…'}
      </p>
      <p>Alerts only fire while this page is open.</p>
    </footer>
  )
}
