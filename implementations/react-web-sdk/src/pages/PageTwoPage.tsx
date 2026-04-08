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
  const { sdk } = useOptimization()
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

      <section data-testid="page-two-optimization" style={{ display: 'grid', gap: 12 }}>
        <h3>Page Two Optimized Content</h3>
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
