import { useEffect, useState } from 'react'
import { PESANGGRAHAN, STALE_AFTER_MS } from './config/station'
import { useLatest } from './hooks/useLatest'
import { useHistory, type Range } from './hooks/useHistory'
import { useTransitionAlert } from './hooks/useTransitionAlert'
import { classify } from './lib/siaga'
import { AlertOptIn } from './components/AlertOptIn'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Footer } from './components/Footer'
import { Map } from './components/Map'
import { RangeToggle } from './components/RangeToggle'
import { SiagaChart } from './components/SiagaChart'
import { StatusCard } from './components/StatusCard'

function useNow(intervalMs: number): Date {
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function App() {
  const now = useNow(30_000)
  const latest = useLatest()
  const [range, setRange] = useState<Range>('24h')
  const history = useHistory(range)

  const currentLevel =
    latest.data === null ? null : classify(latest.data.levelCm, latest.data.thresholdsCm)
  const currentCm = latest.data?.levelCm ?? null

  const alert = useTransitionAlert(currentLevel, currentCm)

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-screen-sm space-y-4 p-4">
        <header className="flex items-baseline justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <div>
            <h1 className="text-lg font-semibold">Banjir Pesanggrahan</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {PESANGGRAHAN.name} · Sungai {PESANGGRAHAN.river}
            </p>
          </div>
        </header>

        {latest.data ? (
          <StatusCard
            snapshot={latest.data}
            isStale={now.getTime() - latest.data.observedAt.getTime() > STALE_AFTER_MS}
            now={now}
          />
        ) : latest.error ? (
          <section className="rounded-2xl bg-red-50 p-6 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
            <p className="font-medium">Could not load latest reading</p>
            <p className="mt-1 text-xs">{latest.error.message}</p>
            <button
              type="button"
              onClick={latest.refresh}
              className="mt-3 min-h-11 rounded-lg bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
            >
              Retry
            </button>
          </section>
        ) : (
          <section className="rounded-2xl bg-white p-6 shadow-sm dark:bg-zinc-900">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Trend</h2>
            <RangeToggle value={range} onChange={setRange} />
          </div>
          {history.data ? (
            <SiagaChart data={history.data} fallbackThresholdsCm={PESANGGRAHAN.fallbackThresholdsCm} />
          ) : history.error ? (
            <div className="rounded-2xl bg-white p-6 text-sm text-zinc-500 shadow-sm dark:bg-zinc-900 dark:text-zinc-400">
              Could not load chart: {history.error.message}
            </div>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-white text-sm text-zinc-500 shadow-sm sm:aspect-[16/9] dark:bg-zinc-900 dark:text-zinc-400">
              Loading chart…
            </div>
          )}
        </section>

        <Map />

        <AlertOptIn
          permission={alert.permission}
          onRequest={() => void alert.requestPermission()}
          onTest={alert.testChime}
        />

        <Footer lastFetchedAt={latest.lastFetchedAt} now={now} />
      </div>
    </ErrorBoundary>
  )
}

export default App
