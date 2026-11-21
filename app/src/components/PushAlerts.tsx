import { useState } from 'react'
import { SERVICE_STALE_AFTER_MS } from '../config/alerts'
import type { PushAlertsState } from '../hooks/usePushAlerts'
import { useI18n } from '../i18n/useI18n'
import type { ServiceStatus } from '../lib/pushClient'

type Props = PushAlertsState & { now: Date }

const PRIMARY =
  'mt-3 min-h-10 rounded-lg bg-ink px-4 text-sm font-medium text-plane hover:opacity-90 disabled:opacity-50'
const SECONDARY =
  'min-h-9 shrink-0 rounded-lg border border-hairline-strong px-3 text-xs font-medium text-ink-2 hover:bg-sunken hover:text-ink disabled:opacity-50'

/** When the alert service last read the river — or a warning if it hasn't lately. */
function ServiceLine({ service, now }: { service: ServiceStatus | null; now: Date }) {
  const { t } = useI18n()
  if (service === null) return null
  const age = service.lastRunAt === null ? Infinity : now.getTime() - service.lastRunAt
  if (age > SERVICE_STALE_AFTER_MS) {
    return (
      <p role="status" className="mt-3 text-xs font-medium text-critical">
        {t.pushServiceStale}
      </p>
    )
  }
  return <p className="mt-3 text-xs text-ink-3">{t.pushServiceChecked(Math.floor(age / 60_000))}</p>
}

function InstallSteps() {
  const { t } = useI18n()
  return (
    <>
      <p className="text-sm font-medium">{t.pushInstallTitle}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-ink-2">
        {t.pushInstallSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </>
  )
}

function OnPanel({ disable, sendTest }: { disable: () => void; sendTest: () => Promise<boolean> }) {
  const { t } = useI18n()
  const [sent, setSent] = useState(false)
  return (
    <>
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-good" />
        {t.pushOnTitle}
      </p>
      <p className="mt-0.5 text-xs text-ink-3">{t.pushOnBody}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={SECONDARY} onClick={() => void sendTest().then(setSent)}>
          {t.pushTest}
        </button>
        <button type="button" className={SECONDARY} onClick={disable}>
          {t.pushTurnOff}
        </button>
      </div>
      {sent && <p className="mt-2 text-xs text-ink-2">{t.pushTestSent}</p>}
    </>
  )
}

function Body({ view, enable, disable, sendTest }: Props) {
  const { t } = useI18n()
  switch (view) {
    case 'needs-install':
      return <InstallSteps />
    case 'unsupported':
      return <p className="text-sm text-ink-2">{t.pushUnsupported}</p>
    case 'denied':
      return <p className="text-sm text-ink-2">{t.pushDenied}</p>
    case 'on':
      return <OnPanel disable={() => void disable()} sendTest={sendTest} />
    case 'off':
    case 'working':
      return (
        <>
          <p className="text-sm font-medium">{t.pushOffTitle}</p>
          <p className="mt-1 text-xs text-ink-3">{t.pushOffBody}</p>
          <button type="button" disabled={view === 'working'} className={PRIMARY} onClick={() => void enable()}>
            {view === 'working' ? t.pushWorking : t.pushEnable}
          </button>
        </>
      )
  }
}

export function PushAlerts(props: Props) {
  const { t } = useI18n()
  return (
    <section aria-label={t.pushRegion} className="rounded-xl bg-surface px-4 py-3.5">
      <Body {...props} />
      {props.error !== null && (
        <p role="alert" className="mt-2 text-xs text-critical">
          {t.pushError(props.error)}
        </p>
      )}
      <ServiceLine service={props.service} now={props.now} />
    </section>
  )
}
