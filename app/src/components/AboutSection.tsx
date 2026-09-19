import { useI18n } from '../i18n/useI18n'
import { bands, siagaMeta } from '../lib/siaga'
import type { ThresholdsCm } from '../types/upstream'

type Props = {
  thresholdsCm: ThresholdsCm
}

export function AboutSection({ thresholdsCm }: Props) {
  const { t } = useI18n()

  return (
    <details className="rounded-xl bg-surface px-4 py-3.5 text-sm">
      <summary className="label cursor-pointer list-none hover:text-ink-2">
        {t.aboutSummary}
      </summary>
      <div className="mt-3 space-y-3 text-ink-2">
        <p>{t.aboutIntro}</p>

        <div>
          <h3 className="label">{t.aboutStatusHeading}</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {bands(thresholdsCm).map((band) => {
              const gloss = t.bandGloss[band.level]
              return (
                <li key={band.level}>
                  <strong>{siagaMeta(band.level).label}</strong>
                  {gloss ? ` (${gloss})` : ''} — {band.rangeText}
                </li>
              )
            })}
          </ul>
        </div>

        <div>
          <h3 className="label">{t.aboutAlertsHeading}</h3>
          <p className="mt-1">{t.aboutAlertsBody}</p>
        </div>

        <div>
          <h3 className="label">{t.aboutSourceHeading}</h3>
          <p className="mt-1">
            {t.aboutSourceBody}{' '}
            <a
              className="text-ink underline-offset-4 hover:underline"
              href="https://poskobanjir.dsdadki.web.id"
              target="_blank"
              rel="noopener noreferrer"
            >
              poskobanjir.dsdadki.web.id
            </a>
            .
          </p>
        </div>
      </div>
    </details>
  )
}
