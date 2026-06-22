import type { JSX } from 'react'
import { AUTO_OBSERVED_ENTRY_IDS, MANUALLY_OBSERVED_ENTRY_IDS } from '../config/entries'
import { useLiveUpdates } from '../optimization/liveUpdates/LiveUpdatesContext'
import type { EntryClickScenario } from '../sections/ContentEntry'
import { ContentEntry } from '../sections/ContentEntry'
import { LiveUpdatesExampleEntry } from '../sections/LiveUpdatesExampleEntry'
import { NestedContentEntry } from '../sections/NestedContentEntry'
import type { ContentfulEntry } from '../types/contentful'

interface HomePageProps {
  consent: boolean | undefined
  entriesById: Map<string, ContentfulEntry>
  globalLiveUpdates: boolean
  isIdentified: boolean
  liveUpdatesBaselineEntry: ContentfulEntry
  selectedOptimizationCount: number
  onConsentChange: (accepted: boolean) => void
  onIdentify: () => void
  onReset: () => void
  onToggleGlobalLiveUpdates: () => void
}

function isConsentAccepted(consent: boolean | undefined): boolean {
  return consent === true
}

function consentLabel(consent: boolean | undefined): string {
  if (consent === true) return 'Yes'
  if (consent === false) return 'No'
  return 'undefined'
}

const AUTO_OBSERVED_CLICK_SCENARIO_BY_ENTRY_ID: Readonly<Record<string, EntryClickScenario>> = {
  '4ib0hsHWoSOnCVdDkizE8d': 'direct',
  xFwgG3oNaOcjzWiGe4vXo: 'descendant',
  '2Z2WLOx07InSewC3LUB3eX': 'ancestor',
}

interface UtilitiesGridProps {
  consent: boolean | undefined
  globalLiveUpdates: boolean
  isIdentified: boolean
  isPreviewPanelOpen: boolean
  selectedOptimizationCount: number
  onConsentChange: (accepted: boolean) => void
  onIdentify: () => void
  onReset: () => void
  onToggleGlobalLiveUpdates: () => void
  onTogglePreviewPanel: () => void
}

function UtilitiesGrid({
  consent,
  globalLiveUpdates,
  isIdentified,
  isPreviewPanelOpen,
  selectedOptimizationCount,
  onConsentChange,
  onIdentify,
  onReset,
  onToggleGlobalLiveUpdates,
  onTogglePreviewPanel,
}: UtilitiesGridProps): JSX.Element {
  return (
    <div className="control-panel__fields">
      <span className="control-panel__row-label">Consent</span>
      <span className="control-panel__row-value" data-testid="consent-status">
        {consentLabel(consent)}
      </span>
      {isConsentAccepted(consent) ? (
        <button
          className="btn btn--danger btn--sm"
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
          className="btn btn--secondary btn--sm"
          data-testid="consent-button"
          onClick={() => {
            onConsentChange(true)
          }}
          type="button"
        >
          Grant
        </button>
      )}

      <span className="control-panel__row-label">Identified</span>
      <span className="control-panel__row-value" data-testid="identified-status">
        {isIdentified ? 'Yes' : 'No'}
      </span>
      {!isIdentified ? (
        <button
          className="btn btn--secondary btn--sm"
          data-testid="identify-button"
          onClick={onIdentify}
          type="button"
        >
          Identify
        </button>
      ) : (
        <button
          className="btn btn--danger btn--sm"
          data-testid="reset-button"
          onClick={onReset}
          type="button"
        >
          Reset
        </button>
      )}

      <span className="control-panel__row-label" data-testid="live-updates-status">
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

      {ENABLE_PREVIEW_PANEL ? (
        <>
          <span className="control-panel__row-label">Preview panel</span>
          <span className="control-panel__row-value" data-testid="preview-panel-status">
            {isPreviewPanelOpen ? 'Open' : 'Closed'}
          </span>
          <button
            className="btn btn--sm btn--secondary"
            data-testid="simulate-preview-panel-button"
            onClick={onTogglePreviewPanel}
            type="button"
          >
            {isPreviewPanelOpen ? 'Close Preview Panel' : 'Open Preview Panel'}
          </button>
        </>
      ) : null}

      <span className="control-panel__row-label">Active optimizations</span>
      <span className="control-panel__row-value" data-testid="selected-optimizations-count">
        {selectedOptimizationCount}
      </span>
      <span />
    </div>
  )
}

export function HomePage({
  consent,
  entriesById,
  globalLiveUpdates,
  isIdentified,
  liveUpdatesBaselineEntry,
  selectedOptimizationCount,
  onConsentChange,
  onIdentify,
  onReset,
  onToggleGlobalLiveUpdates,
}: HomePageProps): JSX.Element {
  const liveUpdatesContext = useLiveUpdates()
  const isPreviewPanelOpen = liveUpdatesContext?.previewPanelVisible === true

  const handleTogglePreviewPanel = (): void => {
    liveUpdatesContext?.togglePreviewPanel()
  }

  return (
    <>
      <div className="page-header">
        <h1>Web SDK + React</h1>
        <p className="page-header__subtitle">
          Reference implementation of @contentful/optimization-web
        </p>
      </div>

      <section className="control-panel" id="utility-panel">
        <h2 className="control-panel__title">Utilities</h2>
        <UtilitiesGrid
          consent={consent}
          globalLiveUpdates={globalLiveUpdates}
          isIdentified={isIdentified}
          isPreviewPanelOpen={isPreviewPanelOpen}
          selectedOptimizationCount={selectedOptimizationCount}
          onConsentChange={onConsentChange}
          onIdentify={onIdentify}
          onReset={onReset}
          onToggleGlobalLiveUpdates={onToggleGlobalLiveUpdates}
          onTogglePreviewPanel={handleTogglePreviewPanel}
        />
      </section>

      <section className="page-section" data-testid="live-updates-section">
        <header className="page-section__header">
          <h2>Live Updates</h2>
          <p>
            Toggle global live updates and identify the user to verify how entries update. Optional
            per-component control is available through the <code>liveUpdates</code> prop.
          </p>
        </header>
        <div className="sections-grid" data-testid="live-updates-examples">
          <LiveUpdatesExampleEntry
            baselineEntry={liveUpdatesBaselineEntry}
            testIdPrefix="live-default"
          />
          <LiveUpdatesExampleEntry
            baselineEntry={liveUpdatesBaselineEntry}
            liveUpdates={true}
            testIdPrefix="live-enabled"
          />
          <LiveUpdatesExampleEntry
            baselineEntry={liveUpdatesBaselineEntry}
            liveUpdates={false}
            testIdPrefix="live-locked"
          />
        </div>
      </section>

      <div className="sections-grid sections-grid--split">
        <section className="page-section">
          <header className="page-section__header">
            <h2>Auto Observed Entries</h2>
          </header>
          <div className="entry-grid" id="auto-observed">
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
                  observation="auto"
                />
              )
            })}
          </div>
        </section>

        <section className="page-section">
          <header className="page-section__header">
            <h2>Manually Observed Entries</h2>
          </header>
          <div className="entry-grid" id="manually-observed">
            {MANUALLY_OBSERVED_ENTRY_IDS.map((entryId) => {
              const entry = entriesById.get(entryId)
              if (!entry) {
                return null
              }

              return <ContentEntry key={entry.sys.id} entry={entry} observation="manual" />
            })}
          </div>
        </section>
      </div>
    </>
  )
}
