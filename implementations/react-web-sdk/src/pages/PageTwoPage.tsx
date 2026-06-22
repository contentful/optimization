import { useOptimization } from '@contentful/optimization-react-web'
import type { JSX } from 'react'
import { useEffect } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { AppOutletContext } from '../App'
import { PAGE_TWO_AUTO_ENTRY_ID, PAGE_TWO_MANUAL_ENTRY_ID } from '../config/entries'
import { HOME_PATH } from '../config/routes'
import { ContentEntry } from '../sections/ContentEntry'

export function PageTwoPage(): JSX.Element {
  const { consent, entriesById, isIdentified } = useOutletContext<AppOutletContext>()
  const sdk = useOptimization()
  const pageTwoAutoEntry = entriesById.get(PAGE_TWO_AUTO_ENTRY_ID)
  const pageTwoManualEntry = entriesById.get(PAGE_TWO_MANUAL_ENTRY_ID)

  useEffect(() => {
    void sdk.trackView({
      componentId: 'page-two-hero',
      viewId: crypto.randomUUID(),
      viewDurationMs: 0,
    })
  }, [sdk])

  const handleDemoCta = (): void => {
    void sdk.trackView({
      componentId: 'page-two-demo-cta',
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

      <section data-testid="page-two-status" className="control-panel">
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
              <ContentEntry entry={pageTwoAutoEntry} viewTracking="auto" />
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
              <ContentEntry entry={pageTwoManualEntry} viewTracking="manual" />
            ) : (
              <p>Manual tracked entry is unavailable.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
