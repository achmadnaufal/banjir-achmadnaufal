import type { NotificationPermissionState } from '../hooks/useTransitionAlert'

type Props = {
  permission: NotificationPermissionState
  onRequest: () => void
  onTest: () => void
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-surface px-4 py-3.5 text-sm text-ink-2">{children}</p>
}

export function AlertOptIn({ permission, onRequest, onTest }: Props) {
  if (permission === 'unsupported') {
    return <Note>Peramban ini tidak mendukung notifikasi. Grafik tetap diperbarui selama halaman terbuka.</Note>
  }

  if (permission === 'denied') {
    return (
      <Note>
        Notifikasi diblokir. Aktifkan kembali di pengaturan situs peramban untuk menerima peringatan
        kenaikan siaga.
      </Note>
    )
  }

  if (permission === 'granted') {
    return (
      <section className="flex items-center gap-4 rounded-xl bg-surface px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-good" />
            Peringatan aktif
          </p>
          <p className="mt-0.5 text-xs text-ink-3">
            Notifikasi dan nada akan berbunyi saat air naik ke band yang lebih tinggi.
          </p>
        </div>
        <button
          type="button"
          onClick={onTest}
          className="min-h-9 shrink-0 rounded-lg border border-hairline-strong px-3 text-xs font-medium text-ink-2 hover:bg-sunken hover:text-ink"
        >
          Tes nada
        </button>
      </section>
    )
  }

  return (
    <section className="rounded-xl bg-surface px-4 py-3.5">
      <p className="text-sm font-medium">Aktifkan peringatan dini</p>
      <p className="mt-1 text-xs text-ink-3">
        Notifikasi hanya berbunyi selama halaman ini terbuka. Pasang di layar utama dan biarkan
        terbuka saat hujan deras.
      </p>
      <button
        type="button"
        onClick={onRequest}
        className="mt-3 min-h-10 rounded-lg bg-ink px-4 text-sm font-medium text-plane hover:opacity-90"
      >
        Aktifkan peringatan
      </button>
    </section>
  )
}
