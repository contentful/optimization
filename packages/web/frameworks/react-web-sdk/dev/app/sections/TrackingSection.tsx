import { useCallback, useRef, useState, type ReactElement } from 'react'
import type { OptimizationSdk } from '../../../src/context/OptimizationContext'

interface TrackingSectionProps {
  sdk: OptimizationSdk
}

export function TrackingSection({ sdk }: TrackingSectionProps): ReactElement {
  const elementRef = useRef<HTMLDivElement>(null)
  const [viewsAttached, setViewsAttached] = useState(false)
  const [lastManualEvent, setLastManualEvent] = useState<string | undefined>(undefined)

  const handleToggleViews = useCallback(() => {
    const { current: element } = elementRef
    if (!element) return

    if (viewsAttached) {
      sdk.tracking.clearElement('views', element)
      setViewsAttached(false)
    } else {
      sdk.tracking.enableElement('views', element, {
        data: { entryId: 'demo-tracking-entry' },
      })
      setViewsAttached(true)
    }
  }, [sdk, viewsAttached])

  const handleTrackClick = useCallback(() => {
    void sdk
      .trackClick({ componentId: 'demo-tracking-entry' })
      .then(() => {
        setLastManualEvent('trackClick sent')
      })
      .catch(() => null)
  }, [sdk])

  const handleTrackView = useCallback(() => {
    void sdk
      .trackView({
        componentId: 'demo-tracking-entry',
        viewId: 'demo-view-1',
        viewDurationMs: 1000,
        sticky: true,
      })
      .then(() => {
        setLastManualEvent('trackView sent')
      })
      .catch(() => null)
  }, [sdk])

  return (
    <section className="dashboard__grid">
      <article className="dashboard__card">
        <h2>Element Tracking</h2>
        <p>Toggle view observation on the target element below via enableElement / clearElement.</p>
        <div
          ref={elementRef}
          style={{
            padding: '0.5rem',
            border: '1px dashed #aaa',
            borderRadius: '4px',
            marginBottom: '0.5rem',
          }}
        >
          {viewsAttached ? 'Observed (views active)' : 'Not observed'}
        </div>
        <div className="dashboard__actions">
          <button onClick={handleToggleViews} type="button">
            {viewsAttached ? 'clearElement (views)' : 'enableElement (views)'}
          </button>
        </div>
      </article>

      <article className="dashboard__card">
        <h2>Imperative Tracking</h2>
        <p>Fire trackClick() or trackView() manually without any DOM observation.</p>
        <div className="dashboard__actions">
          <button onClick={handleTrackClick} type="button">
            trackClick()
          </button>
          <button onClick={handleTrackView} type="button">
            trackView()
          </button>
        </div>
        {lastManualEvent ? <p>{lastManualEvent}</p> : null}
      </article>
    </section>
  )
}
