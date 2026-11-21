import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { COMMUNITY, PESANGGRAHAN } from './config/station'
import { useLatest } from './hooks/useLatest'
import { rangeWindowStart, useHistory, type Range } from './hooks/useHistory'
import { useManualReadings } from './hooks/useManualReadings'
import { useTheme } from './hooks/useTheme'
import { usePushAlerts } from './hooks/usePushAlerts'
import { useTransitionAlert } from './hooks/useTransitionAlert'
import { LocaleProvider } from './i18n/LocaleProvider'
import { useI18n } from './i18n/useI18n'
import {
  pickReading,
  sensorReading,
  staleAfterMs,
  withManualPoints,
} from './lib/manualFallback'
import { STATION_DEFAULTS } from './lib/stationDefaults'
import { classify } from './lib/siaga'
import { AboutSection } from './components/AboutSection'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Footer } from './components/Footer'
import { HistoryTable } from './components/HistoryTable'
import { KeteranganLegend } from './components/KeteranganLegend'
import { LocaleToggle } from './components/LocaleToggle'
import { Map } from './components/Map'
import { PushAlerts } from './components/PushAlerts'
import { RangeToggle } from './components/RangeToggle'
import { StatusCard } from './components/StatusCard'
import { ThemeToggle } from './components/ThemeToggle'

// Recharts is by far the heaviest dependency here. Splitting it out lets the
// current water level — the only thing that matters in a hurry — paint
// without waiting for the charting library to download and parse.
const SiagaChart = lazy(() =>
  import('./components/SiagaChart').then((m) => ({ default: m.SiagaChart })),
)

function ChartPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-surface text-sm text-ink-3 sm:aspect-[16/9]">
      {children}
    </div>
  )
}

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function Dashboard() {
  const { t, locale } = useI18n()
  const now = useNow(30_000)
  const theme = useTheme()
  const latest = useLatest()
  const [range, setRange] = useState<Range>('24h')
  const history = useHistory(range)
  // The stats card always summarises the last 24h. When that is also the
  // charted range, reuse the same response instead of fetching it twice.
  const stats24h = useHistory(range === '24h' ? null : '24h')
  const stats = range === '24h' ? history : stats24h
  const manual = useManualReadings()

  // DSDA's sensor first (snapshot or time-series, whichever is newer); BPBD's
  // hourly manual table only when it is newer than both.
  const reading = useMemo(
    () =>
      pickReading(
        sensorReading(latest.data, stats.data, STATION_DEFAULTS),
        manual.data,
        STATION_DEFAULTS,
      ),
    [latest.data, stats.data, manual.data],
  )
  const displaySnapshot = reading?.snapshot ?? null
  const source = reading?.source ?? 'sensor'
  // Windows for the manual points end at the reading they lead up to.
  const readingAt = displaySnapshot?.observedAt ?? null

  // While the manual reading is on show, carry the chart and the 24h stats
  // past the sensor's last point with it, so they don't freeze or go empty.
  const chartData = useMemo(
    () =>
      readingAt === null
        ? history.data
        : withManualPoints(history.data, manual.data, rangeWindowStart(range, readingAt), source),
    [history.data, manual.data, range, readingAt, source],
  )
  const statsData = useMemo(
    () =>
      readingAt === null
        ? stats.data
        : withManualPoints(stats.data, manual.data, rangeWindowStart('24h', readingAt), source),
    [stats.data, manual.data, readingAt, source],
  )

  const currentLevel =
    displaySnapshot === null
      ? null
      : classify(displaySnapshot.levelCm, displaySnapshot.thresholdsCm)
  const currentCm = displaySnapshot?.levelCm ?? null

  // Prefer the thresholds upstream reports for this gate; fall back to the
  // published KETERANGAN values only until the first successful fetch.
  const thresholdsCm =
    displaySnapshot?.thresholdsCm ??
    chartData?.thresholdsCm ??
    PESANGGRAHAN.fallbackThresholdsCm

  // useHistory keeps the previous response in state across a range change, so
  // a refetch holds its frame. Dimming it — rather than swapping in a
  // skeleton — avoids a flash and a layout jump under the reader's thumb.
  const chartIsRefreshing = history.isLoading && chartData !== null

  const alertCopy = useMemo(
    () => ({ title: t.alertRisingTitle, body: t.alertRisingBody }),
    [t],
  )
  // In-page chime while the page is open; closed-page alerts come from the push service.
  useTransitionAlert(currentLevel, currentCm, alertCopy)
  const push = usePushAlerts(locale)

  return (
    <div className="mx-auto max-w-screen-sm px-4">
      <header className="flex items-center justify-between gap-2 border-b border-hairline py-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] leading-tight font-semibold tracking-[-0.01em]">
            {t.appTitle}
          </h1>
          <p className="mt-0.5 text-xs leading-tight font-medium text-ink-2">{COMMUNITY}</p>
          <p className="text-[11px] leading-tight text-ink-3">{t.appRiver(PESANGGRAHAN.river)}</p>
        </div>
        <LocaleToggle />
        <ThemeToggle preference={theme.preference} onCycle={theme.cycle} />
      </header>

      <main className="space-y-3 py-4">
        {reading ? (
          <StatusCard
            snapshot={reading.snapshot}
            source={reading.source}
            isStale={
              now.getTime() - reading.snapshot.observedAt.getTime() > staleAfterMs(reading.source)
            }
            now={now}
            stats={statsData}
          />
        ) : latest.error ? (
          <section className="overflow-hidden rounded-xl bg-surface">
            <div className="h-1 w-full bg-critical" />
            <div className="px-5 py-4">
              <p className="text-sm font-medium">{t.loadFailedTitle}</p>
              <p className="mt-1 text-xs text-ink-3">{latest.error.message}</p>
              <button
                type="button"
                onClick={latest.refresh}
                className="mt-3 min-h-10 rounded-lg bg-ink px-4 text-sm font-medium text-plane hover:opacity-90"
              >
                {t.retry}
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-xl bg-surface px-5 py-8">
            <p className="text-sm text-ink-3">{t.loading}</p>
          </section>
        )}

        {/* One filter row, above everything it scopes. */}
        <div className="pt-2">
          <RangeToggle value={range} onChange={setRange} />
        </div>

        <div className="space-y-2">
          {chartData ? (
            <div
              className={`transition-opacity ${chartIsRefreshing ? 'opacity-50' : ''}`}
              aria-busy={chartIsRefreshing}
            >
              <Suspense fallback={<ChartPlaceholder>{t.chartLoading}</ChartPlaceholder>}>
                <SiagaChart
                  data={chartData}
                  fallbackThresholdsCm={PESANGGRAHAN.fallbackThresholdsCm}
                  theme={theme.resolved}
                />
              </Suspense>
            </div>
          ) : history.error ? (
            <div className="rounded-xl bg-surface px-4 py-6 text-sm text-ink-3">
              {t.chartFailed(history.error.message)}
            </div>
          ) : (
            <ChartPlaceholder>{t.chartLoading}</ChartPlaceholder>
          )}

          {chartData && (
            <HistoryTable
              data={chartData}
              fallbackThresholdsCm={PESANGGRAHAN.fallbackThresholdsCm}
            />
          )}
        </div>

        <KeteranganLegend thresholdsCm={thresholdsCm} currentLevel={currentLevel} />

        <PushAlerts {...push} now={now} />

        <Map theme={theme.resolved} />

        <AboutSection thresholdsCm={thresholdsCm} />
      </main>

      <Footer lastFetchedAt={latest.lastFetchedAt} />
    </div>
  )
}

/** Sits inside the provider so the boundary's own copy is translated too. */
function Shell() {
  const { t } = useI18n()
  return (
    <ErrorBoundary title={t.errorTitle} reloadLabel={t.reload}>
      <Dashboard />
    </ErrorBoundary>
  )
}

function App() {
  return (
    <LocaleProvider>
      <Shell />
    </LocaleProvider>
  )
}

export default App
