import type { Locale } from './locale'

/**
 * Every user-facing string. `en` and `id` share one type, so a missing or
 * misspelled translation is a compile error rather than a blank label.
 *
 * The siaga band names (BAHAYA / SIAGA / WASPADA) are deliberately NOT
 * translated: they are the designations DSDA, BPBD and RT/RW announcements
 * actually use, so a reader on the English UI still needs to recognise them.
 * English gets a gloss alongside instead — see `bandGloss`.
 */
export type Messages = {
  appTitle: string
  appSubtitle: (river: string) => string
  themeSystem: string
  themeLight: string
  themeDark: string
  languageLabel: string

  statusRegion: string
  staleData: string
  noPreviousReading: string
  vsPrevious: string
  observedAt: (stamp: string) => string
  trendRising: string
  trendFalling: string
  trendFlat: string

  statsRegion: string
  gathering: string
  peak24h: string
  rate60m: string
  rateUnit: string
  inBand: (band: string) => string
  forecast: string
  etaRising: string
  etaFalling: string
  steady: string
  noBandChange: string
  etaTo: (band: string) => string
  cmAboveNow: (n: number) => string
  cmBelowNow: (n: number) => string

  rangeLabel: string
  range6h: string
  range12h: string
  range24h: string
  range7d: string
  range30d: string
  range60d: string

  chartEmpty: string
  chartLoading: string
  chartFailed: (message: string) => string
  peakLabel: (n: number) => string
  anomaliesHidden: (n: number) => string

  tableToggle: string
  tableCaption: string
  tableTime: string
  tableLevel: string
  tableStatus: string

  legendHeading: string
  legendRegion: string
  bandGloss: Record<'siaga1' | 'siaga2' | 'siaga3' | 'normal', string | null>
  currentStatusNote: string

  alertsUnsupported: string
  alertsBlocked: string
  alertsOnTitle: string
  alertsOnBody: string
  alertsTestChime: string
  alertsOptInTitle: string
  alertsOptInBody: string
  alertsEnable: string
  alertRisingTitle: (band: string, level: string) => string
  alertRisingBody: string

  mapRegion: string
  mapHeading: string
  mapOpen: string

  loadFailedTitle: string
  retry: string
  loading: string
  errorTitle: string
  reload: string

  footerSource: string
  footerAgency: string
  footerLastPoll: (time: string) => string
  footerFetching: string
  footerAlertsNote: string
  footerSourceCode: string

  aboutSummary: string
  aboutIntro: string
  aboutStatusHeading: string
  aboutAlertsHeading: string
  aboutAlertsBody: string
  aboutSourceHeading: string
  aboutSourceBody: string

  durationDay: (n: number) => string
  durationHourMin: (h: number, m: number) => string
  durationMin: (n: number) => string
  justNow: string
}

const en: Messages = {
  appTitle: 'Cinangka Flood Monitor',
  appSubtitle: (river) => `${river} River\u00a0· Paradisa Residence`,
  themeSystem: 'Theme: follow system',
  themeLight: 'Theme: light',
  themeDark: 'Theme: dark',
  languageLabel: 'Language',

  statusRegion: 'Current status',
  staleData: 'stale data',
  noPreviousReading: 'no previous reading',
  vsPrevious: 'vs previous reading',
  observedAt: (stamp) => `Observed ${stamp}`,
  trendRising: 'rising',
  trendFalling: 'falling',
  trendFlat: 'flat',

  statsRegion: 'Last 24 hours summary',
  gathering: 'Gathering 24-hour trend…',
  peak24h: '24h peak',
  rate60m: '60-min rate',
  rateUnit: 'cm/h',
  inBand: (band) => `In ${band}`,
  forecast: 'Forecast',
  etaRising: 'ETA rising',
  etaFalling: 'ETA falling',
  steady: 'steady',
  noBandChange: 'no band change expected',
  etaTo: (band) => `to ${band} · at current rate`,
  cmAboveNow: (n) => `${n} cm above now`,
  cmBelowNow: (n) => `${n} cm below now`,

  rangeLabel: 'Range',
  range6h: '6h',
  range12h: '12h',
  range24h: '24h',
  range7d: '7d',
  range30d: '30d',
  range60d: '60d',

  chartEmpty: 'No data yet',
  chartLoading: 'Loading chart…',
  chartFailed: (message) => `Could not load chart: ${message}`,
  peakLabel: (n) => `peak ${n}`,
  anomaliesHidden: (n) =>
    `${n} sensor-anomaly reading${n === 1 ? '' : 's'} (negative) hidden.`,

  tableToggle: 'View as table',
  tableCaption: 'Pesanggrahan River water level, newest first',
  tableTime: 'Time',
  tableLevel: 'Level',
  tableStatus: 'Status',

  legendHeading: 'Legend',
  legendRegion: 'Siaga status legend',
  bandGloss: {
    siaga1: 'Danger',
    siaga2: 'Alert',
    siaga3: 'Caution',
    normal: null,
  },
  currentStatusNote: '(current status)',

  alertsUnsupported:
    'This browser does not support notifications. The chart still updates while the page is open.',
  alertsBlocked:
    'Notifications are blocked. Re-enable them in your browser site settings to get rising-siaga alerts.',
  alertsOnTitle: 'Alerts on',
  alertsOnBody: "You'll get a notification and a chime when the level rises into a higher band.",
  alertsTestChime: 'Test chime',
  alertsOptInTitle: 'Enable early warning',
  alertsOptInBody:
    'Notifications only fire while this page is open. Pin it to your home screen and leave it open during heavy rain.',
  alertsEnable: 'Enable alerts',
  alertRisingTitle: (band, level) => `${band} rising — ${level}`,
  alertRisingBody: 'Pesanggrahan water level entered a higher alert band.',

  mapRegion: 'Station location',
  mapHeading: 'Monitoring post',
  mapOpen: 'Open in maps →',

  loadFailedTitle: 'Could not load the latest reading',
  retry: 'Try again',
  loading: 'Loading…',
  errorTitle: 'Something went wrong',
  reload: 'Reload',

  footerSource: 'Data source',
  footerAgency: 'Jakarta Water Resources Agency (DSDA DKI)',
  footerLastPoll: (time) => `Last update ${time} WIB`,
  footerFetching: 'Fetching latest data…',
  footerAlertsNote: 'alerts only fire while this page is open',
  footerSourceCode: 'source code',

  aboutSummary: 'About this page',
  aboutIntro:
    'Cinangka Paradisa Residence Flood Monitor is an unofficial water-level and early-warning page for residents of Cinangka Paradisa Residence — a housing complex in Cinangka, Sawangan, Depok, West Java (postcode 16518), on the Pesanggrahan River. Data comes from the Pesanggrahan observation post (P.S. Pesanggrahan 1) run by the Jakarta Water Resources Agency and refreshes about every 10 minutes.',
  aboutStatusHeading: 'Siaga status levels',
  aboutAlertsHeading: 'How the early warning works',
  aboutAlertsBody:
    'While this tab is open, the browser fires a notification and a chime when the water level rises past a siaga threshold. For fastest access during heavy rain, add this page to your home screen as an app (PWA). Notifications only sound while the tab is open — this is not full push — so combine it with official BPBD information.',
  aboutSourceHeading: 'Data source',
  aboutSourceBody:
    'The Pesanggrahan observation post (station code 34, ID 160) upstream on the Pesanggrahan River, published openly at',

  durationDay: (n) => `${n} day${n === 1 ? '' : 's'}`,
  durationHourMin: (h, m) => `${h}h ${m}m`,
  durationMin: (n) => `${n} min`,
  justNow: 'just now',
}

const id: Messages = {
  appTitle: 'Monitor Banjir Cinangka',
  appSubtitle: (river) => `Sungai ${river}\u00a0· Paradisa Residence`,
  themeSystem: 'Tema: ikut sistem',
  themeLight: 'Tema: terang',
  themeDark: 'Tema: gelap',
  languageLabel: 'Bahasa',

  statusRegion: 'Status terkini',
  staleData: 'data tertunda',
  noPreviousReading: 'belum ada bacaan sebelumnya',
  vsPrevious: 'dari bacaan sebelumnya',
  observedAt: (stamp) => `Terbaca ${stamp}`,
  trendRising: 'naik',
  trendFalling: 'turun',
  trendFlat: 'datar',

  statsRegion: 'Ringkasan 24 jam',
  gathering: 'Mengumpulkan tren 24 jam…',
  peak24h: 'Puncak 24 jam',
  rate60m: 'Laju 60 menit',
  rateUnit: 'cm/j',
  inBand: (band) => `Di ${band}`,
  forecast: 'Perkiraan',
  etaRising: 'Perkiraan naik',
  etaFalling: 'Perkiraan turun',
  steady: 'stabil',
  noBandChange: 'tak ada perubahan band',
  etaTo: (band) => `ke ${band} · laju kini`,
  cmAboveNow: (n) => `${n} cm di atas kini`,
  cmBelowNow: (n) => `${n} cm di bawah kini`,

  rangeLabel: 'Rentang',
  range6h: '6j',
  range12h: '12j',
  range24h: '24j',
  range7d: '7h',
  range30d: '30h',
  range60d: '60h',

  chartEmpty: 'Belum ada data',
  chartLoading: 'Memuat grafik…',
  chartFailed: (message) => `Gagal memuat grafik: ${message}`,
  peakLabel: (n) => `puncak ${n}`,
  anomaliesHidden: (n) => `${n} bacaan anomali (negatif) disembunyikan.`,

  tableToggle: 'Lihat sebagai tabel',
  tableCaption: 'Tinggi muka air Sungai Pesanggrahan, terbaru lebih dulu',
  tableTime: 'Waktu',
  tableLevel: 'Tinggi',
  tableStatus: 'Status',

  legendHeading: 'Keterangan',
  legendRegion: 'Keterangan status siaga',
  bandGloss: { siaga1: null, siaga2: null, siaga3: null, normal: null },
  currentStatusNote: '(status saat ini)',

  alertsUnsupported:
    'Peramban ini tidak mendukung notifikasi. Grafik tetap diperbarui selama halaman terbuka.',
  alertsBlocked:
    'Notifikasi diblokir. Aktifkan kembali di pengaturan situs peramban untuk menerima peringatan kenaikan siaga.',
  alertsOnTitle: 'Peringatan aktif',
  alertsOnBody: 'Notifikasi dan nada akan berbunyi saat air naik ke band yang lebih tinggi.',
  alertsTestChime: 'Tes nada',
  alertsOptInTitle: 'Aktifkan peringatan dini',
  alertsOptInBody:
    'Notifikasi hanya berbunyi selama halaman ini terbuka. Pasang di layar utama dan biarkan terbuka saat hujan deras.',
  alertsEnable: 'Aktifkan peringatan',
  alertRisingTitle: (band, level) => `${band} naik — ${level}`,
  alertRisingBody: 'Tinggi muka air Pesanggrahan masuk ke band siaga yang lebih tinggi.',

  mapRegion: 'Lokasi pos pantau',
  mapHeading: 'Pos pantau',
  mapOpen: 'Buka di peta →',

  loadFailedTitle: 'Gagal memuat bacaan terbaru',
  retry: 'Coba lagi',
  loading: 'Memuat…',
  errorTitle: 'Terjadi kesalahan',
  reload: 'Muat ulang',

  footerSource: 'Sumber data',
  footerAgency: 'Dinas SDA DKI Jakarta',
  footerLastPoll: (time) => `Pembaruan terakhir ${time} WIB`,
  footerFetching: 'Mengambil data terbaru…',
  footerAlertsNote: 'peringatan hanya aktif selama halaman terbuka',
  footerSourceCode: 'kode sumber',

  aboutSummary: 'Tentang halaman ini',
  aboutIntro:
    'Monitor Banjir Cinangka Paradisa Residence adalah pemantau tinggi muka air dan peringatan dini banjir tidak resmi untuk warga perumahan Cinangka Paradisa Residence — komplek hunian di Kelurahan Cinangka, Kecamatan Sawangan, Kota Depok, Jawa Barat (kode pos 16518), wilayah yang dilewati aliran Sungai Pesanggrahan. Data diambil dari pos pemantauan Pesanggrahan (P.S. Pesanggrahan 1) milik Dinas Sumber Daya Air Provinsi DKI Jakarta dan diperbarui setiap ~10 menit.',
  aboutStatusHeading: 'Keterangan status siaga',
  aboutAlertsHeading: 'Cara kerja peringatan dini',
  aboutAlertsBody:
    'Saat tab halaman terbuka, peramban akan memberi notifikasi otomatis dan bunyi peringatan ketika tinggi muka air naik melewati ambang siaga. Untuk akses cepat saat hujan deras, pasang halaman ini di layar utama ponsel sebagai aplikasi (PWA). Notifikasi hanya berbunyi saat tab terbuka — bukan push penuh — kombinasikan dengan informasi resmi BPBD.',
  aboutSourceHeading: 'Sumber data',
  aboutSourceBody:
    'Pos pemantauan Pesanggrahan (kode stasiun 34, ID 160) di hulu Sungai Pesanggrahan, dipublikasikan secara terbuka di',

  durationDay: (n) => `${n} hari`,
  durationHourMin: (h, m) => `${h}j ${m}mnt`,
  durationMin: (n) => `${n} mnt`,
  justNow: 'baru saja',
}

export const MESSAGES: Record<Locale, Messages> = { en, id }
