import type { ForecastProblem } from '../lib/forecastRetry'
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
  appRiver: (river: string) => string
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
  manualReadingNote: string

  statsRegion: string
  gathering: string
  peak24h: string
  rate60m: string
  rate2h: string
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

  pushRegion: string
  pushInstallTitle: string
  pushInstallSteps: readonly string[]
  pushOffTitle: string
  pushOffBody: string
  pushEnable: string
  pushWorking: string
  pushOnTitle: string
  pushOnBody: string
  pushTest: string
  pushTestSent: string
  pushTurnOff: string
  pushDenied: string
  pushUnsupported: string
  pushServiceChecked: (minutes: number) => string
  pushServiceStale: string
  pushError: (detail: string) => string
  alertRisingTitle: (band: string, level: string) => string
  alertRisingBody: string

  mapRegion: string
  mapHeading: string
  mapOpen: string
  rainHeading: string
  rainSource: string
  rainLoading: string
  /** One line per failure kind — never the raw error, whose URL runs to 5 KB. */
  rainProblem: Record<ForecastProblem, string>
  rainStale: string
  rainUpdated: (time: string) => string
  rainPlay: string
  rainPause: string
  rainSlider: string
  rainFrame: (time: string) => string
  rainUpstreamTotal: (mm: string) => string
  rainUpstreamPeak: (from: string, mm: string) => string
  rainUpstreamDry: string
  /** WMO rain-rate classes, in order: light, moderate, heavy, extreme. */
  rainLegendClasses: readonly [string, string, string, string]
  rainGate: string

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
  footerFallback: string

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
  appTitle: 'Flood Monitor',
  appRiver: (river) => `${river} River`,
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
  manualReadingNote:
    'Hourly manual gauge reading via BPBD DKI — the automatic sensor has not reported anything newer.',

  statsRegion: 'Last 24 hours summary',
  gathering: 'Gathering 24-hour trend…',
  peak24h: '24h peak',
  rate60m: '60-min rate',
  rate2h: '2-hour rate',
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

  pushRegion: 'Flood alerts',
  pushInstallTitle: 'Get alerts even when this page is closed',
  pushInstallSteps: [
    'In Safari, tap the Share button',
    'Choose “Add to Home Screen”',
    'Open Monitor Banjir from your Home Screen',
    'Tap “Turn on alerts” there',
  ],
  pushOffTitle: 'Alerts while the page is closed',
  pushOffBody:
    'Get a notification when the river reaches WASPADA (150 cm) or higher — at most once an hour, right away if it climbs a band, and once when it is back to normal.',
  pushEnable: 'Turn on alerts',
  pushWorking: 'One moment…',
  pushOnTitle: 'Alerts are on for this phone',
  pushOnBody: 'They arrive even when this page is closed.',
  pushTest: 'Send test',
  pushTestSent: 'Test sent — check your notifications.',
  pushTurnOff: 'Turn off',
  pushDenied:
    'Notifications are blocked for this app. Turn them on in Settings → Notifications → Monitor Banjir, then come back.',
  pushUnsupported:
    "This browser can't get alerts while the page is closed. On iPhone, update to iOS 16.4 or later and add this page to the Home Screen from Safari.",
  pushServiceChecked: (minutes) =>
    minutes < 1 ? 'Alert service checked just now' : `Alert service checked ${minutes} min ago`,
  pushServiceStale: 'The alert service has not checked the river recently — alerts may be delayed.',
  pushError: (detail) => `Couldn't change alerts: ${detail}`,
  alertRisingTitle: (band, level) => `${band} rising — ${level}`,
  alertRisingBody: 'Pesanggrahan water level entered a higher alert band.',

  mapRegion: 'Station location',
  mapHeading: 'Monitoring post',
  mapOpen: 'Open in maps →',
  rainHeading: 'Rain forecast · next 12 h',
  rainSource: 'Weather-model forecast from Open-Meteo, not radar. The dashed box is the catchment upstream of the gate.',
  rainLoading: 'Loading rain forecast…',
  rainProblem: {
    busy: 'The forecast service is busy right now. Retrying in about a minute.',
    offline: 'Can’t reach the forecast service. Retrying shortly.',
    unavailable: 'The forecast service returned an error. Retrying shortly.',
  },
  rainStale: 'Showing the last saved forecast while it retries.',
  rainUpdated: (time) => `Forecast updated ${time} WIB`,
  rainPlay: 'Play',
  rainPause: 'Pause',
  rainSlider: 'Forecast hour',
  rainFrame: (time) => `${time} WIB`,
  rainUpstreamTotal: (mm) => `Upstream: ${mm} mm expected in the next 12 h`,
  rainUpstreamPeak: (from, mm) => `heaviest around ${from} (${mm} mm/h)`,
  rainUpstreamDry: 'No rain expected upstream in the next 12 h',
  rainLegendClasses: ['Light', 'Moderate', 'Heavy', 'Extreme'],
  rainGate: 'Water gate',

  loadFailedTitle: 'Could not load the latest reading',
  retry: 'Try again',
  loading: 'Loading…',
  errorTitle: 'Something went wrong',
  reload: 'Reload',

  footerSource: 'Data source',
  footerAgency: 'Jakarta Water Resources Agency (DSDA DKI)',
  footerLastPoll: (time) => `Last update ${time} WIB`,
  footerFetching: 'Fetching latest data…',
  footerAlertsNote: 'turn on alerts to get them with the page closed',
  footerSourceCode: 'source code',
  footerFallback: 'hourly fallback',

  aboutSummary: 'About this page',
  aboutIntro:
    'Cinangka Paradisa Residence Flood Monitor is an unofficial water-level and early-warning page for residents of Cinangka Paradisa Residence — a housing complex in Cinangka, Sawangan, Depok, West Java (postcode 16518), on the Pesanggrahan River. Data comes from the Pesanggrahan observation post (P.S. Pesanggrahan 1) run by the Jakarta Water Resources Agency and refreshes about every 10 minutes.',
  aboutStatusHeading: 'Siaga status levels',
  aboutAlertsHeading: 'How the early warning works',
  aboutAlertsBody:
    'Turn on alerts to get a phone notification when the river reaches WASPADA (150 cm) or higher, even with this page closed: at most once an hour, right away if it climbs a band, and once when it is back to normal. On iPhone, first add this page to your Home Screen from Safari (iOS 16.4 or later) and turn alerts on from there. While the page is open it also plays a chime. These alerts are unofficial — combine them with official BPBD information.',
  aboutSourceHeading: 'Data source',
  aboutSourceBody:
    'The Pesanggrahan observation post (station code 34, ID 160) upstream on the Pesanggrahan River, published openly at',

  durationDay: (n) => `${n} day${n === 1 ? '' : 's'}`,
  durationHourMin: (h, m) => `${h}h ${m}m`,
  durationMin: (n) => `${n} min`,
  justNow: 'just now',
}

const id: Messages = {
  appTitle: 'Monitor Banjir',
  appRiver: (river) => `Sungai ${river}`,
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
  manualReadingNote:
    'Pembacaan papan duga manual per jam dari BPBD DKI — sensor otomatis belum mengirim data yang lebih baru.',

  statsRegion: 'Ringkasan 24 jam',
  gathering: 'Mengumpulkan tren 24 jam…',
  peak24h: 'Puncak 24 jam',
  rate60m: 'Laju 60 menit',
  rate2h: 'Laju 2 jam',
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

  pushRegion: 'Peringatan banjir',
  pushInstallTitle: 'Dapatkan peringatan walau halaman ini tertutup',
  pushInstallSteps: [
    'Di Safari, ketuk tombol Bagikan',
    'Pilih “Tambah ke Layar Utama”',
    'Buka Monitor Banjir dari Layar Utama',
    'Ketuk “Nyalakan peringatan” di sana',
  ],
  pushOffTitle: 'Peringatan saat halaman tertutup',
  pushOffBody:
    'Dapatkan notifikasi saat sungai mencapai WASPADA (150 cm) atau lebih — paling sering sejam sekali, langsung jika naik satu band, dan sekali saat kembali normal.',
  pushEnable: 'Nyalakan peringatan',
  pushWorking: 'Sebentar…',
  pushOnTitle: 'Peringatan aktif di ponsel ini',
  pushOnBody: 'Tetap datang walau halaman ini tertutup.',
  pushTest: 'Kirim tes',
  pushTestSent: 'Tes terkirim — cek notifikasi.',
  pushTurnOff: 'Matikan',
  pushDenied:
    'Notifikasi diblokir untuk aplikasi ini. Nyalakan di Pengaturan → Notifikasi → Monitor Banjir, lalu kembali ke sini.',
  pushUnsupported:
    'Peramban ini tidak bisa menerima peringatan saat halaman tertutup. Di iPhone, perbarui ke iOS 16.4 atau lebih baru dan tambahkan halaman ini ke Layar Utama dari Safari.',
  pushServiceChecked: (minutes) =>
    minutes < 1 ? 'Layanan peringatan baru saja mengecek' : `Layanan peringatan dicek ${minutes} menit lalu`,
  pushServiceStale: 'Layanan peringatan belum mengecek sungai baru-baru ini — peringatan bisa terlambat.',
  pushError: (detail) => `Gagal mengubah peringatan: ${detail}`,
  alertRisingTitle: (band, level) => `${band} naik — ${level}`,
  alertRisingBody: 'Tinggi muka air Pesanggrahan masuk ke band siaga yang lebih tinggi.',

  mapRegion: 'Lokasi pos pantau',
  mapHeading: 'Pos pantau',
  mapOpen: 'Buka di peta →',
  rainHeading: 'Prakiraan hujan · 12 jam ke depan',
  rainSource: 'Prakiraan model cuaca dari Open-Meteo, bukan radar. Kotak putus-putus adalah daerah hulu pintu air.',
  rainLoading: 'Memuat prakiraan hujan…',
  rainProblem: {
    busy: 'Layanan prakiraan sedang sibuk. Mencoba lagi dalam sekitar satu menit.',
    offline: 'Tidak dapat terhubung ke layanan prakiraan. Mencoba lagi sebentar lagi.',
    unavailable: 'Layanan prakiraan mengembalikan galat. Mencoba lagi sebentar lagi.',
  },
  rainStale: 'Menampilkan prakiraan tersimpan terakhir sambil mencoba lagi.',
  rainUpdated: (time) => `Prakiraan diperbarui ${time} WIB`,
  rainPlay: 'Putar',
  rainPause: 'Jeda',
  rainSlider: 'Jam prakiraan',
  rainFrame: (time) => `${time} WIB`,
  rainUpstreamTotal: (mm) => `Hulu: diperkirakan ${mm} mm dalam 12 jam ke depan`,
  rainUpstreamPeak: (from, mm) => `paling deras sekitar ${from} (${mm} mm/jam)`,
  rainUpstreamDry: 'Tidak ada hujan di hulu dalam 12 jam ke depan',
  rainLegendClasses: ['Ringan', 'Sedang', 'Lebat', 'Ekstrem'],
  rainGate: 'Pintu air',

  loadFailedTitle: 'Gagal memuat bacaan terbaru',
  retry: 'Coba lagi',
  loading: 'Memuat…',
  errorTitle: 'Terjadi kesalahan',
  reload: 'Muat ulang',

  footerSource: 'Sumber data',
  footerAgency: 'Dinas SDA DKI Jakarta',
  footerLastPoll: (time) => `Pembaruan terakhir ${time} WIB`,
  footerFetching: 'Mengambil data terbaru…',
  footerAlertsNote: 'nyalakan peringatan agar tetap datang walau halaman tertutup',
  footerSourceCode: 'kode sumber',
  footerFallback: 'cadangan per jam',

  aboutSummary: 'Tentang halaman ini',
  aboutIntro:
    'Monitor Banjir Cinangka Paradisa Residence adalah pemantau tinggi muka air dan peringatan dini banjir tidak resmi untuk warga perumahan Cinangka Paradisa Residence — komplek hunian di Kelurahan Cinangka, Kecamatan Sawangan, Kota Depok, Jawa Barat (kode pos 16518), wilayah yang dilewati aliran Sungai Pesanggrahan. Data diambil dari pos pemantauan Pesanggrahan (P.S. Pesanggrahan 1) milik Dinas Sumber Daya Air Provinsi DKI Jakarta dan diperbarui setiap ~10 menit.',
  aboutStatusHeading: 'Keterangan status siaga',
  aboutAlertsHeading: 'Cara kerja peringatan dini',
  aboutAlertsBody:
    'Nyalakan peringatan untuk menerima notifikasi di ponsel saat sungai mencapai WASPADA (150 cm) atau lebih, walau halaman ini tertutup: paling sering sejam sekali, langsung jika naik satu band, dan sekali saat kembali normal. Di iPhone, tambahkan dulu halaman ini ke Layar Utama dari Safari (iOS 16.4 atau lebih baru) lalu nyalakan peringatan dari sana. Saat halaman terbuka, nada peringatan juga berbunyi. Peringatan ini tidak resmi — kombinasikan dengan informasi resmi BPBD.',
  aboutSourceHeading: 'Sumber data',
  aboutSourceBody:
    'Pos pemantauan Pesanggrahan (kode stasiun 34, ID 160) di hulu Sungai Pesanggrahan, dipublikasikan secara terbuka di',

  durationDay: (n) => `${n} hari`,
  durationHourMin: (h, m) => `${h}j ${m}mnt`,
  durationMin: (n) => `${n} mnt`,
  justNow: 'baru saja',
}

export const MESSAGES: Record<Locale, Messages> = { en, id }
