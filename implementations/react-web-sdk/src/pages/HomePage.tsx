import { useLiveUpdates } from '@contentful/optimization-react-web'
import type { JSX } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { AppOutletContext } from '../App'
import { AUTO_OBSERVED_ENTRY_IDS, MANUALLY_OBSERVED_ENTRY_IDS } from '../config/entries'
import { type EntryClickScenario, ContentEntry } from '../sections/ContentEntry'
import { LiveUpdatesExampleEntry } from '../sections/LiveUpdatesExampleEntry'
import { NestedContentEntry } from '../sections/NestedContentEntry'
import type { ContentEntry as ContentEntryType } from '../types/contentful'

const ENABLE_PREVIEW_PANEL = import.meta.env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL === 'true'

const AUTO_OBSERVED_CLICK_SCENARIO_BY_ENTRY_ID: Readonly<Record<string, EntryClickScenario>> = {
  '4ib0hsHWoSOnCVdDkizE8d': 'direct',
  xFwgG3oNaOcjzWiGe4vXo: 'descendant',
  '2Z2WLOx07InSewC3LUB3eX': 'ancestor',
}

function consentLabel(consent: boolean | undefined): string {
  if (consent === true) return 'Yes'
  if (consent === false) return 'No'
  return 'undefined'
}

interface UtilitiesGridProps {
  consent: boolean | undefined
  globalLiveUpdates: boolean
  isIdentified: boolean
  previewPanelVisible: boolean
  selectedOptimizationCount: number
  onConsentChange: (accepted: boolean) => void
  onIdentify: () => void
  onReset: () => void
  onToggleGlobalLiveUpdates: () => void
  setPreviewPanelVisible: (visible: boolean) => void
}

function UtilitiesGrid({
  consent,
  globalLiveUpdates,
  isIdentified,
  previewPanelVisible,
  selectedOptimizationCount,
  onConsentChange,
  onIdentify,
  onReset,
  onToggleGlobalLiveUpdates,
  setPreviewPanelVisible,
}: UtilitiesGridProps): JSX.Element {
  return (
    <div className="control-grid">
      <span>Consent</span>
      <span data-testid="consent-status">{consentLabel(consent)}</span>
      {consent === true ? (
        <button
          data-testid="unconsent-button"
          onClick={() => {
            onConsentChange(false)
          }}
          type="button"
        >
          Revoke
        </button>
      ) : (
        <button
          data-testid="consent-button"
          onClick={() => {
            onConsentChange(true)
          }}
          type="button"
        >
          Grant
        </button>
      )}

      <span>Identified</span>
      <span data-testid="identified-status">{isIdentified ? 'Yes' : 'No'}</span>
      {!isIdentified ? (
        <button data-testid="identify-button" onClick={onIdentify} type="button">
          Identify
        </button>
      ) : (
        <button data-testid="reset-button" onClick={onReset} type="button">
          Reset
        </button>
      )}

      <span>Live updates</span>
      <span data-testid="global-live-updates-status">{globalLiveUpdates ? 'ON' : 'OFF'}</span>
      <button
        data-testid="toggle-global-live-updates-button"
        onClick={onToggleGlobalLiveUpdates}
        type="button"
      >
        {globalLiveUpdates ? 'OFF' : 'ON'}
      </button>

      <span>Preview panel</span>
      <span data-testid="preview-panel-status">{previewPanelVisible ? 'Open' : 'Closed'}</span>
      {ENABLE_PREVIEW_PANEL ? (
        <button
          data-testid="simulate-preview-panel-button"
          onClick={() => {
            setPreviewPanelVisible(!previewPanelVisible)
          }}
          type="button"
        >
          {previewPanelVisible ? 'Close' : 'Open'}
        </button>
      ) : (
        <span />
      )}

      <span>Active optimizations</span>
      <span data-testid="selected-optimizations-count">{selectedOptimizationCount}</span>
      <span />
    </div>
  )
}

interface AutoObservedEntriesProps {
  entriesById: Map<string, ContentEntryType>
}

function AutoObservedEntries({ entriesById }: AutoObservedEntriesProps): JSX.Element {
  return (
    <div className="section-stack" id="auto-observed">
      {AUTO_OBSERVED_ENTRY_IDS.map((entryId) => {
        const entry = entriesById.get(entryId)
        if (!entry) {
          return null
        }

        if (entry.sys.contentType.sys.id === 'nestedContent') {
          return <NestedContentEntry key={entry.sys.id} entry={entry} />
        }

        return (
          <ContentEntry
            key={entry.sys.id}
            clickScenario={AUTO_OBSERVED_CLICK_SCENARIO_BY_ENTRY_ID[entry.sys.id]}
            entry={entry}
            viewTracking="auto"
          />
        )
      })}
    </div>
  )
}

interface ManuallyObservedEntriesProps {
  entriesById: Map<string, ContentEntryType>
}

function ManuallyObservedEntries({ entriesById }: ManuallyObservedEntriesProps): JSX.Element {
  return (
    <div className="section-stack" id="manually-observed">
      {MANUALLY_OBSERVED_ENTRY_IDS.map((entryId) => {
        const entry = entriesById.get(entryId)
        if (!entry) {
          return null
        }

        return <ContentEntry key={entry.sys.id} entry={entry} viewTracking="manual" />
      })}
    </div>
  )
}

export function HomePage(): JSX.Element {
  const {
    consent,
    entriesById,
    isIdentified,
    liveUpdatesBaselineEntry,
    selectedOptimizationCount,
    onConsentChange,
    onIdentify,
    onReset,
    onToggleGlobalLiveUpdates,
  } = useOutletContext<AppOutletContext>()
  const { globalLiveUpdates, previewPanelVisible, setPreviewPanelVisible } = useLiveUpdates()
  const isOptimizationReady = selectedOptimizationCount > 0 || entriesById.size > 0

  if (!isOptimizationReady) {
    return <p data-testid="home-loading">Loading optimization data...</p>
  }

  return (
    <>
      <section id="utility-panel">
        <h2>Utilities</h2>
        <UtilitiesGrid
          consent={consent}
          globalLiveUpdates={globalLiveUpdates}
          isIdentified={isIdentified}
          previewPanelVisible={previewPanelVisible}
          selectedOptimizationCount={selectedOptimizationCount}
          onConsentChange={onConsentChange}
          onIdentify={onIdentify}
          onReset={onReset}
          onToggleGlobalLiveUpdates={onToggleGlobalLiveUpdates}
          setPreviewPanelVisible={setPreviewPanelVisible}
        />
      </section>

      <section>
        <h2>Live Updates</h2>
        <p>
          Toggle global live updates and identify the user to verify how entries update. Optional
          per-component control is available through the <code>liveUpdates</code> prop.
        </p>
        {liveUpdatesBaselineEntry ? (
          <div className="section-stack" data-testid="live-updates-examples">
            <section data-testid="live-updates-default">
              <h3>Default (inherits global setting)</h3>
              <LiveUpdatesExampleEntry
                baselineEntry={liveUpdatesBaselineEntry}
                testIdPrefix="live-default"
              />
            </section>

            <section data-testid="live-updates-enabled">
              <h3>Always On (liveUpdates=true)</h3>
              <LiveUpdatesExampleEntry
                baselineEntry={liveUpdatesBaselineEntry}
                liveUpdates={true}
                testIdPrefix="live-enabled"
              />
            </section>

            <section data-testid="live-updates-locked">
              <h3>Locked (liveUpdates=false)</h3>
              <LiveUpdatesExampleEntry
                baselineEntry={liveUpdatesBaselineEntry}
                liveUpdates={false}
                testIdPrefix="live-locked"
              />
            </section>
          </div>
        ) : (
          <p data-testid="live-updates-loading">Loading live updates entries...</p>
        )}
      </section>

      <section>
        <h2>Auto Observed Entries</h2>
        <AutoObservedEntries entriesById={entriesById} />
      </section>

      <section>
        <h2>Manually Observed Entries</h2>
        <ManuallyObservedEntries entriesById={entriesById} />
      </section>
    </>
  )
}
