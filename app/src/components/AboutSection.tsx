export function AboutSection() {
  return (
    <details className="rounded-2xl bg-white p-4 text-sm shadow-sm dark:bg-zinc-900">
      <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-200">
        Tentang halaman ini
      </summary>
      <div className="mt-3 space-y-3 text-zinc-600 dark:text-zinc-300">
        <p>
          <strong>Monitor Banjir Cinangka Paradisa Residence</strong> adalah
          pemantau tinggi muka air dan peringatan dini banjir tidak resmi
          untuk warga perumahan Cinangka Paradisa Residence. Data diambil
          dari pos pemantauan Pesanggrahan (P.S. Pesanggrahan 1) milik
          Dinas Sumber Daya Air Provinsi DKI Jakarta dan diperbarui setiap
          ~10 menit.
        </p>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Status Siaga
          </h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>
              <strong>Normal</strong> — di bawah 150 cm
            </li>
            <li>
              <strong>Siaga 3 (Waspada)</strong> — 150–250 cm
            </li>
            <li>
              <strong>Siaga 2 (Siaga)</strong> — 250–350 cm
            </li>
            <li>
              <strong>Siaga 1 (Awas)</strong> — di atas 350 cm
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Cara kerja peringatan dini
          </h3>
          <p className="mt-1">
            Saat tab halaman terbuka, peramban akan memberi notifikasi
            otomatis dan bunyi peringatan ketika tinggi muka air naik
            melewati ambang siaga. Untuk akses cepat saat hujan deras,
            pasang halaman ini di layar utama ponsel sebagai aplikasi
            (PWA). Notifikasi hanya berbunyi saat tab terbuka — bukan
            push penuh — kombinasikan dengan informasi resmi BPBD.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Sumber data
          </h3>
          <p className="mt-1">
            Pos pemantauan Pesanggrahan (kode stasiun 34, ID 160) di hulu
            Sungai Pesanggrahan, dipublikasikan secara terbuka di{' '}
            <a
              className="underline-offset-2 hover:underline"
              href="https://poskobanjir.dsdadki.web.id"
              target="_blank"
              rel="noopener noreferrer"
            >
              poskobanjir.dsdadki.web.id
            </a>
            . Halaman ini menampilkan ulang data tersebut tanpa modifikasi
            nilai. Bukan streaming real-time — penyegaran berkala setiap
            ~10 menit.
          </p>
        </div>
      </div>
    </details>
  )
}
