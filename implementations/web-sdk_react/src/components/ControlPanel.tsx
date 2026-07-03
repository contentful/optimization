import type { JSX } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useOptimization } from '../optimization/hooks/useOptimization'
import { useOptimizationState } from '../optimization/hooks/useOptimizationState'
import { useLiveUpdates } from '../optimization/liveUpdates/LiveUpdatesContext'

function displayFlagValue(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return String(value)
  }
  return JSON.stringify(value)
}

function ConsentAction({
  consent,
  onToggle,
}: {
  consent: boolean | undefined
  onToggle: () => void
}): JSX.Element {
  return consent === true ? (
    <button
      className="btn btn--danger btn--sm"
      data-testid="unconsent-button"
      onClick={onToggle}
      type="button"
    >
      Revoke
    </button>
  ) : (
    <button
      className="btn btn--secondary btn--sm"
      data-testid="consent-button"
      onClick={onToggle}
      type="button"
    >
      Grant
    </button>
  )
}

function IdentifiedAction({
  isIdentified,
  onIdentify,
  onReset,
}: {
  isIdentified: boolean
  onIdentify: () => void
  onReset: () => void
}): JSX.Element {
  return isIdentified ? (
    <button
      className="btn btn--danger btn--sm"
      data-testid="reset-button"
      onClick={onReset}
      type="button"
    >
      Reset
    </button>
  ) : (
    <button
      className="btn btn--secondary btn--sm"
      data-testid="identify-button"
      onClick={onIdentify}
      type="button"
    >
      Identify
    </button>
  )
}

interface ControlPanelFieldsProps {
  consent: boolean | undefined
  isIdentified: boolean
  globalLiveUpdates: boolean
  isPreviewPanelOpen: boolean
  selectedOptimizationCount: number
  booleanFlagDisplay: string
  onToggleConsent: () => void
  onIdentify: () => void
  onReset: () => void
  onToggleGlobalLiveUpdates: () => void
  onTogglePreviewPanel: () => void
}

function ControlPanelFields({
  consent,
  isIdentified,
  globalLiveUpdates,
  isPreviewPanelOpen,
  selectedOptimizationCount,
  booleanFlagDisplay,
  onToggleConsent,
  onIdentify,
  onReset,
  onToggleGlobalLiveUpdates,
  onTogglePreviewPanel,
}: ControlPanelFieldsProps): JSX.Element {
  return (
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
      <ConsentAction consent={consent} onToggle={onToggleConsent} />

      <span
        className="control-panel__row-label"
        data-tooltip="User has been identified with a profile via the identify() call"
      >
        Identified
      </span>
      <span className="control-panel__row-value" data-testid="identified-status">
        {isIdentified ? 'Yes' : 'No'}
      </span>
      <IdentifiedAction isIdentified={isIdentified} onIdentify={onIdentify} onReset={onReset} />

      <span
        className="control-panel__row-label"
        data-testid="live-updates-status"
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
        {isPreviewPanelOpen ? 'Open' : 'Closed'}
      </span>
      {ENABLE_PREVIEW_PANEL ? (
        <button
          className="btn btn--sm btn--secondary"
          data-testid="simulate-preview-panel-button"
          onClick={onTogglePreviewPanel}
          type="button"
        >
          {isPreviewPanelOpen ? 'Close Preview Panel' : 'Open Preview Panel'}
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
      <span className="control-panel__row-value">{booleanFlagDisplay}</span>
      <span />

      <span
        className="control-panel__row-label"
        data-tooltip="Number of selected optimization variants currently applied"
      >
        Active optimizations
      </span>
      <span className="control-panel__row-value" data-testid="selected-optimizations-count">
        {selectedOptimizationCount}
      </span>
      <span />
    </div>
  )
}

interface ControlPanelProps {
  onToggleGlobalLiveUpdates: () => void
  onTrackConversion?: () => void
}

export function ControlPanel({
  onToggleGlobalLiveUpdates,
  onTrackConversion,
}: ControlPanelProps): JSX.Element {
  const { sdk } = useOptimization()
  const { consent, profile, selectedOptimizations } = useOptimizationState(sdk?.states)
  const liveUpdatesContext = useLiveUpdates()

  const [booleanFlag, setBooleanFlag] = useState<unknown>(undefined)

  useEffect(() => {
    if (sdk === undefined) {
      return
    }

    const subscription = sdk.states.flag('boolean').subscribe(setBooleanFlag)

    return () => {
      subscription.unsubscribe()
    }
  }, [sdk])

  const isIdentified = useMemo(() => Boolean(profile?.traits.identified), [profile])
  const selectedOptimizationCount = useMemo(
    () => (Array.isArray(selectedOptimizations) ? selectedOptimizations.length : 0),
    [selectedOptimizations],
  )
  const globalLiveUpdates = liveUpdatesContext?.globalLiveUpdates === true
  const isPreviewPanelOpen = liveUpdatesContext?.previewPanelVisible === true

  return (
    <section className="control-panel" id="utility-panel">
      <h2 className="control-panel__title">Utilities</h2>

      <ControlPanelFields
        booleanFlagDisplay={displayFlagValue(booleanFlag)}
        consent={consent}
        globalLiveUpdates={globalLiveUpdates}
        isIdentified={isIdentified}
        isPreviewPanelOpen={isPreviewPanelOpen}
        selectedOptimizationCount={selectedOptimizationCount}
        onIdentify={() => {
          void sdk?.identify({ userId: 'charles', traits: { identified: true } })
        }}
        onReset={() => {
          sdk?.reset()
        }}
        onToggleConsent={() => {
          sdk?.consent(consent !== true)
        }}
        onToggleGlobalLiveUpdates={onToggleGlobalLiveUpdates}
        onTogglePreviewPanel={() => {
          liveUpdatesContext?.togglePreviewPanel()
        }}
      />

      {onTrackConversion !== undefined ? (
        <div className="control-panel__actions">
          <button
            className="btn btn--secondary btn--sm"
            data-testid="track-conversion-button"
            onClick={onTrackConversion}
            type="button"
          >
            Trigger custom view event
          </button>
        </div>
      ) : null}
    </section>
  )
}
