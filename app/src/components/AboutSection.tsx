export function AboutSection() {
  return (
    <details className="rounded-xl bg-surface px-4 py-3.5 text-sm">
      <summary className="label cursor-pointer list-none hover:text-ink-2">
        Tentang halaman ini
      </summary>
      <div className="mt-3 space-y-3 text-ink-2">
        <p>
          <strong>Monitor Banjir Cinangka Paradisa Residence</strong> adalah
          pemantau tinggi muka air dan peringatan dini banjir tidak resmi
          untuk warga perumahan Cinangka Paradisa Residence — komplek
          hunian di Kelurahan Cinangka, Kecamatan Sawangan, Kota Depok,
          Jawa Barat (kode pos 16518), wilayah yang dilewati aliran
          Sungai Pesanggrahan. Data diambil dari pos pemantauan
          Pesanggrahan (P.S. Pesanggrahan 1) milik Dinas Sumber Daya Air
          Provinsi DKI Jakarta dan diperbarui setiap ~10 menit.
        </p>

        <div>
          <h3 className="label">
            Keterangan Status Siaga
          </h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            <li>
              <strong>BAHAYA</strong> (Siaga 1) — di atas 350 cm
            </li>
            <li>
              <strong>SIAGA</strong> (Siaga 2) — 250–350 cm
            </li>
            <li>
              <strong>WASPADA</strong> (Siaga 3) — 150–250 cm
            </li>
            <li>
              <strong>Normal</strong> — di bawah 150 cm
            </li>
          </ul>
        </div>

        <div>
          <h3 className="label">
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
          <h3 className="label">
            Sumber data
          </h3>
          <p className="mt-1">
            Pos pemantauan Pesanggrahan (kode stasiun 34, ID 160) di hulu
            Sungai Pesanggrahan, dipublikasikan secara terbuka di{' '}
            <a
              className="text-ink underline-offset-4 hover:underline"
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
