'use client'

import { useGlobalLiveUpdatesControls } from '@/components/GlobalLiveUpdatesProvider'
import { appConfig } from '@/lib/config'
import { useConsent, useFlagSubscription } from '@/lib/hooks'
import {
  useLiveUpdates,
  useOptimization,
  useOptimizationActions,
  useProfileState,
  useSelectedOptimizationsState,
} from '@contentful/optimization-nextjs/client'
import type { JSX } from 'react'

interface ControlPanelProps {
  readonly demoCTA?: boolean
  readonly initialConsent?: boolean
  readonly initialIsIdentified?: boolean
  readonly initialActiveOptimizationsCount?: number
}

export function ControlPanel({
  demoCTA,
  initialConsent,
  initialIsIdentified = false,
  initialActiveOptimizationsCount = 0,
}: ControlPanelProps = {}): JSX.Element {
  const sdk = useOptimization()
  const { identify, reset } = useOptimizationActions()
  const { consent, setConsent } = useConsent(initialConsent)
  const profile = useProfileState()
  const selectedOptimizations = useSelectedOptimizationsState()
  const { globalLiveUpdates, onToggleGlobalLiveUpdates } = useGlobalLiveUpdatesControls()
  const { previewPanelVisible, setPreviewPanelVisible } = useLiveUpdates()
  const booleanFlag = useFlagSubscription('boolean')
  const isIdentified = profile ? Boolean(profile.traits.identified) : initialIsIdentified
  const activeCount = selectedOptimizations?.length ?? initialActiveOptimizationsCount

  return (
    <section className="control-panel" id="utility-panel">
      <h2 className="control-panel__title">Utilities</h2>

      <div className="control-panel__fields">
        <span
          className="control-panel__row-label"
          data-tooltip="SDK tracking is active only when consent is true"
        >
          Consent
        </span>
        <span className="control-panel__row-value" data-testid="consent-status">
          {consent === true ? 'Yes' : consent === false ? 'No' : 'undefined'}
        </span>
        {consent === true ? (
          <button
            className="btn btn--danger btn--sm"
            data-testid="unconsent-button"
            onClick={() => {
              setConsent(false)
            }}
            type="button"
          >
            Revoke
          </button>
        ) : (
          <button
            className="btn btn--secondary btn--sm"
            data-testid="consent-button"
            onClick={() => {
              setConsent(true)
            }}
            type="button"
          >
            Grant
          </button>
        )}

        <span
          className="control-panel__row-label"
          data-tooltip="User has been identified with a profile via the identify() call"
        >
          Identified
        </span>
        <span className="control-panel__row-value" data-testid="identified-status">
          {isIdentified ? 'Yes' : 'No'}
        </span>
        {isIdentified ? (
          <button
            className="btn btn--danger btn--sm"
            data-testid="reset-button"
            onClick={() => {
              reset()
            }}
            type="button"
          >
            Reset
          </button>
        ) : (
          <button
            className="btn btn--secondary btn--sm"
            data-testid="identify-button"
            onClick={() => {
              void identify({ userId: 'charles', traits: { identified: true } })
            }}
            type="button"
          >
            Identify
          </button>
        )}

        <span
          className="control-panel__row-label"
          data-tooltip="When ON, entries re-resolve and rerender on profile changes"
        >
          Live updates
        </span>
        <span className="control-panel__row-value" data-testid="global-live-updates-status">
          {globalLiveUpdates ? 'ON' : 'OFF'}
        </span>
        <button
          className={`btn btn--sm ${globalLiveUpdates ? 'btn--danger' : 'btn--secondary'}`}
          data-testid="toggle-global-live-updates-button"
          onClick={onToggleGlobalLiveUpdates}
          type="button"
        >
          {globalLiveUpdates ? 'OFF' : 'ON'}
        </button>

        <span
          className="control-panel__row-label"
          data-tooltip="Contentful preview panel is open — forces live updates regardless of the global toggle"
        >
          Preview panel
        </span>
        <span className="control-panel__row-value" data-testid="preview-panel-status">
          {previewPanelVisible ? 'Open' : 'Closed'}
        </span>
        {appConfig.previewPanelEnabled ? (
          <button
            className="btn btn--sm btn--secondary"
            data-testid="simulate-preview-panel-button"
            onClick={() => {
              setPreviewPanelVisible(!previewPanelVisible)
            }}
            type="button"
          >
            {previewPanelVisible ? 'Close Preview Panel' : 'Open Preview Panel'}
          </button>
        ) : (
          <span />
        )}

        <span
          className="control-panel__row-label"
          data-testid="boolean-flag-status"
          data-tooltip="Value of the boolean feature flag from the SDK"
        >
          Flag &quot;boolean&quot;
        </span>
        <span className="control-panel__row-value">{String(booleanFlag ?? 'undefined')}</span>
        <span />

        <span
          className="control-panel__row-label"
          data-tooltip="Number of selected optimization variants currently applied"
        >
          Active optimizations
        </span>
        <span className="control-panel__row-value" data-testid="selected-optimizations-count">
          {activeCount}
        </span>
        <span />
      </div>

      {demoCTA ? (
        <div className="control-panel__actions">
          <button
            className="btn btn--secondary btn--sm"
            data-testid="track-conversion-button"
            onClick={() => {
              void sdk.trackView({
                componentId: 'page-two-demo-cta',
                viewId: crypto.randomUUID(),
                viewDurationMs: 0,
              })
            }}
            type="button"
          >
            Trigger custom view event
          </button>
        </div>
      ) : null}
    </section>
  )
}
