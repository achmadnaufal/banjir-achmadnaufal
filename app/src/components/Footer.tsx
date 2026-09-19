type Props = {
  lastFetchedAt: Date | null
}

const POLL_TIME_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function Footer({ lastFetchedAt }: Props) {
  return (
    <footer className="mt-2 border-t border-hairline px-1 pt-5 pb-8 text-xs text-ink-3">
      <p>
        Sumber data{' '}
        <a
          className="text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          href="https://poskobanjir.dsdadki.web.id"
          target="_blank"
          rel="noopener noreferrer"
        >
          poskobanjir.dsdadki.web.id
        </a>{' '}
        · Dinas SDA DKI Jakarta
      </p>
      <p className="mt-1">
        {lastFetchedAt
          ? `Pembaruan terakhir ${POLL_TIME_FORMATTER.format(lastFetchedAt)} WIB · peringatan hanya aktif selama halaman terbuka`
          : 'Mengambil data terbaru…'}
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
          kode sumber
        </a>
      </p>
    </footer>
  )
}
