import { type JSX, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PAGE_TWO_AUTO_ENTRY_ID, PAGE_TWO_MANUAL_ENTRY_ID } from '../config/entries'
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
  const pageTwoAutoEntry = entriesById.get(PAGE_TWO_AUTO_ENTRY_ID)
  const pageTwoManualEntry = entriesById.get(PAGE_TWO_MANUAL_ENTRY_ID)

  useEffect(() => {
    void trackView({
      componentId: 'page-two-hero',
      viewId: crypto.randomUUID(),
      viewDurationMs: 0,
    })
  }, [trackView])

  const handleDemoCta = (): void => {
    void trackView({
      componentId: 'track-conversion-button',
      viewId: crypto.randomUUID(),
      viewDurationMs: 0,
    })
  }

  return (
    <div data-testid="page-two-view">
      <div className="page-header">
        <Link data-testid="link-back-home" to={HOME_PATH}>
          Back to Home
        </Link>
        <h1>Page Two</h1>
        <p className="page-header__subtitle">
          Demo route for SPA navigation, route context (<code>/page-two</code>), and
          conversion-style tracking.
        </p>
      </div>

      <section className="control-panel" data-testid="page-two-status">
        <h2 className="control-panel__title">Status</h2>
        <div className="control-panel__fields">
          <span className="control-panel__row-label">Identified</span>
          <span className="control-panel__row-value">{isIdentified ? 'Yes' : 'No'}</span>
          <span />
          <span className="control-panel__row-label">Consent</span>
          <span className="control-panel__row-value">{String(consent)}</span>
          <span />
        </div>
        <div className="control-panel__actions">
          <button
            className="btn btn--secondary btn--sm"
            data-testid="track-conversion-button"
            onClick={handleDemoCta}
            type="button"
          >
            Trigger Page Two CTA Event
          </button>
        </div>
      </section>

      <div className="sections-grid sections-grid--split" data-testid="page-two-optimization">
        <section className="page-section">
          <header className="page-section__header">
            <h2>Auto-observed</h2>
          </header>
          <div className="entry-grid">
            {pageTwoAutoEntry ? (
              <ContentEntry entry={pageTwoAutoEntry} observation="auto" />
            ) : (
              <p>Auto tracked entry is unavailable.</p>
            )}
          </div>
        </section>

        <section className="page-section">
          <header className="page-section__header">
            <h2>Manually-observed</h2>
          </header>
          <div className="entry-grid">
            {pageTwoManualEntry ? (
              <ContentEntry entry={pageTwoManualEntry} observation="manual" />
            ) : (
              <p>Manual tracked entry is unavailable.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
