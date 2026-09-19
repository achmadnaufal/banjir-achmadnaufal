import { useI18n } from '../i18n/useI18n'

type Props = {
  lastFetchedAt: Date | null
}

const POLL_CACHE = new Map<string, Intl.DateTimeFormat>()

function pollTime(tag: string): Intl.DateTimeFormat {
  let f = POLL_CACHE.get(tag)
  if (!f) {
    f = new Intl.DateTimeFormat(tag, {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    POLL_CACHE.set(tag, f)
  }
  return f
}

export function Footer({ lastFetchedAt }: Props) {
  const { t, tag } = useI18n()

  return (
    <footer className="mt-2 border-t border-hairline px-1 pt-5 pb-8 text-xs text-ink-3">
      <p>
        {t.footerSource}{' '}
        <a
          className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          href="https://poskobanjir.dsdadki.web.id"
          target="_blank"
          rel="noopener noreferrer"
        >
          poskobanjir.dsdadki.web.id
        </a>{' '}
        · {t.footerAgency}
      </p>
      <p className="mt-1">
        {lastFetchedAt
          ? `${t.footerLastPoll(pollTime(tag).format(lastFetchedAt))} · ${t.footerAlertsNote}`
          : t.footerFetching}
      </p>
      <p className="mt-3">
        <a
          className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          href="https://achmadnaufal.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Achmad Naufal
        </a>
        {' · '}
        <a
          className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          href="https://github.com/achmadnaufal/banjir-achmadnaufal"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.footerSourceCode}
        </a>
      </p>
    </footer>
  )
}
