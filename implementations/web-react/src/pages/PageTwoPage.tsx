import { type JSX, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AUTO_OBSERVED_ENTRY_IDS, MANUALLY_OBSERVED_ENTRY_IDS } from '../config/entries'
import { HOME_PATH } from '../config/routes'
import { useAnalytics } from '../optimization/hooks/useAnalytics'
import { ContentEntry } from '../sections/ContentEntry'
import type { ContentfulEntry } from '../types/contentful'

interface PageTwoPageProps {
  consent: boolean | undefined
  entriesById: Map<string, ContentfulEntry>
  isIdentified: boolean
}

export function PageTwoPage({ consent, entriesById, isIdentified }: PageTwoPageProps): JSX.Element {
  const { trackView } = useAnalytics()
  const pageTwoAutoEntry = entriesById.get(AUTO_OBSERVED_ENTRY_IDS[4])
  const pageTwoManualEntry = entriesById.get(MANUALLY_OBSERVED_ENTRY_IDS[0])

  useEffect(() => {
    void trackView({ componentId: 'page-two-hero' })
  }, [trackView])

  const handleDemoCta = (): void => {
    void trackView({ componentId: 'page-two-demo-cta' })
  }

  return (
    <section data-testid="page-two-view" style={{ display: 'grid', gap: 16 }}>
      <h2>Page Two</h2>
      <p>
        Demo route for SPA navigation, route context (<code>/page-two</code>), and conversion-style
        tracking.
      </p>

      <section data-testid="page-two-status" style={{ display: 'grid', gap: 2 }}>
        <p>{`Identified: ${isIdentified ? 'Yes' : 'No'}`}</p>
        <p>{`Consent: ${String(consent)}`}</p>
      </section>

      <section data-testid="page-two-personalization" style={{ display: 'grid', gap: 12 }}>
        <h3>Page Two Personalized Content</h3>
        {pageTwoAutoEntry ? (
          <div>
            <p>Auto tracked example</p>
            <ContentEntry entry={pageTwoAutoEntry} observation="auto" />
          </div>
        ) : (
          <p>Auto tracked entry is unavailable.</p>
        )}

        {pageTwoManualEntry ? (
          <div>
            <p>Manual tracked example</p>
            <ContentEntry entry={pageTwoManualEntry} observation="manual" />
          </div>
        ) : (
          <p>Manual tracked entry is unavailable.</p>
        )}
      </section>
      <section data-testid="page-two-conversion" style={{ display: 'grid', gap: 8 }}>
        <h3>Conversion Step Demo</h3>
        <button data-testid="page-two-demo-cta" onClick={handleDemoCta} type="button">
          Trigger Page Two CTA Event
        </button>
      </section>

      <Link data-testid="link-back-home" to={HOME_PATH}>
        Back to Home
      </Link>
    </section>
  )
}
