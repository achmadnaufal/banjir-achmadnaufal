import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { PESANGGRAHAN, STALE_AFTER_MS } from './config/station'
import { useLatest } from './hooks/useLatest'
import { useHistory, type Range } from './hooks/useHistory'
import { useTheme } from './hooks/useTheme'
import { useTransitionAlert } from './hooks/useTransitionAlert'
import { LocaleProvider } from './i18n/LocaleProvider'
import { useI18n } from './i18n/useI18n'
import { freshestSnapshot } from './lib/analytics'
import { classify } from './lib/siaga'
import { AboutSection } from './components/AboutSection'
import { AlertOptIn } from './components/AlertOptIn'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Footer } from './components/Footer'
import { HistoryTable } from './components/HistoryTable'
import { KeteranganLegend } from './components/KeteranganLegend'
import { LocaleToggle } from './components/LocaleToggle'
import { Map } from './components/Map'
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
  const { t } = useI18n()
  const now = useNow(30_000)
  const theme = useTheme()
  const latest = useLatest()
  const [range, setRange] = useState<Range>('24h')
  const history = useHistory(range)
  // The stats card always summarises the last 24h. When that is also the
  // charted range, reuse the same response instead of fetching it twice.
  const stats24h = useHistory(range === '24h' ? null : '24h')
  const stats = range === '24h' ? history : stats24h

  const displaySnapshot = useMemo(
    () => (latest.data ? freshestSnapshot(latest.data, stats.data) : null),
    [latest.data, stats.data],
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
    history.data?.thresholdsCm ??
    PESANGGRAHAN.fallbackThresholdsCm

  // useHistory keeps the previous response in state across a range change, so
  // a refetch holds its frame. Dimming it — rather than swapping in a
  // skeleton — avoids a flash and a layout jump under the reader's thumb.
  const chartData = history.data
  const chartIsRefreshing = history.isLoading && chartData !== null

  const alertCopy = useMemo(
    () => ({ title: t.alertRisingTitle, body: t.alertRisingBody }),
    [t],
  )
  const alert = useTransitionAlert(currentLevel, currentCm, alertCopy)

  return (
    <div className="mx-auto max-w-screen-sm px-4">
      <header className="flex items-center justify-between gap-2 border-b border-hairline py-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] leading-tight font-semibold tracking-[-0.01em]">
            {t.appTitle}
          </h1>
          <p className="mt-0.5 text-xs text-balance text-ink-3">
            {t.appSubtitle(PESANGGRAHAN.river)}
          </p>
        </div>
        <LocaleToggle />
        <ThemeToggle preference={theme.preference} onCycle={theme.cycle} />
      </header>

      <main className="space-y-3 py-4">
        {displaySnapshot ? (
          <StatusCard
            snapshot={displaySnapshot}
            isStale={now.getTime() - displaySnapshot.observedAt.getTime() > STALE_AFTER_MS}
            now={now}
            stats={stats.data}
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

        <AlertOptIn
          permission={alert.permission}
          onRequest={() => void alert.requestPermission()}
          onTest={alert.testChime}
        />

        <Map />

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
