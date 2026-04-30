import type { NotificationPermissionState } from '../hooks/useTransitionAlert'

type Props = {
  permission: NotificationPermissionState
  onRequest: () => void
  onTest: () => void
}

export function AlertOptIn({ permission, onRequest, onTest }: Props) {
  if (permission === 'unsupported') {
    return (
      <div className="rounded-2xl bg-white p-4 text-sm text-zinc-500 shadow-sm dark:bg-zinc-900 dark:text-zinc-400">
        Notifications are not supported on this browser. The chart will still update while this page is open.
      </div>
    )
  }

  if (permission === 'denied') {
    return (
      <div className="rounded-2xl bg-white p-4 text-sm text-zinc-600 shadow-sm dark:bg-zinc-900 dark:text-zinc-400">
        Notifications are blocked. Re-enable them in your browser site settings to get rising-siaga alerts.
      </div>
    )
  }

  if (permission === 'granted') {
    return (
      <section className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900">
        <div>
          <p className="font-medium">Alerts on</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            You'll get a notification + chime when the level rises into a higher siaga band.
          </p>
        </div>
        <button
          type="button"
          onClick={onTest}
          className="min-h-11 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Test chime
        </button>
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900">
      <p className="mb-2 font-medium">Enable rising-siaga alerts</p>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Browser notifications fire only while this page is open. Pin to your home screen and keep it open in
        the background for monitoring.
      </p>
      <button
        type="button"
        onClick={onRequest}
        className="min-h-11 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Enable alerts
      </button>
    </section>
  )
}
