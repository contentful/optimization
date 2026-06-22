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

  return (
    <>
      <section id="utility-panel">
        <h2>Utilities</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto auto auto',
            alignItems: 'center',
            gap: '0.35rem 0.75rem',
          }}
        >
          <span>Consent</span>
          <span data-testid="consent-status">{consentLabel(consent)}</span>
          {isConsentAccepted(consent) ? (
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

          <span data-testid="live-updates-status">Live updates</span>
          <span data-testid="global-live-updates-status">{globalLiveUpdates ? 'ON' : 'OFF'}</span>
          <button
            data-testid="toggle-global-live-updates-button"
            onClick={onToggleGlobalLiveUpdates}
            type="button"
          >
            {globalLiveUpdates ? 'OFF' : 'ON'}
          </button>

          {ENABLE_PREVIEW_PANEL ? (
            <>
              <span>Preview panel</span>
              <span data-testid="preview-panel-status">
                {isPreviewPanelOpen ? 'Open' : 'Closed'}
              </span>
              <button
                data-testid="simulate-preview-panel-button"
                onClick={() => {
                  liveUpdatesContext?.togglePreviewPanel()
                }}
                type="button"
              >
                {isPreviewPanelOpen ? 'Close Preview Panel' : 'Open Preview Panel'}
              </button>
            </>
          ) : null}

          <span>Active optimizations</span>
          <span data-testid="selected-optimizations-count">{selectedOptimizationCount}</span>
          <span />
        </div>
      </section>

      <section>
        <h2>Live Updates</h2>
        <p>
          Toggle global live updates and identify the user to verify how entries update. Optional
          per-component control is available through the <code>liveUpdates</code> prop.
        </p>
        <div data-testid="live-updates-examples" style={{ display: 'grid', gap: 16 }}>
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

      <section>
        <h2>Auto Observed Entries</h2>
        <div id="auto-observed" style={{ display: 'grid', gap: 16 }}>
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

      <section>
        <h2>Manually Observed Entries</h2>
        <div id="manually-observed" style={{ display: 'grid', gap: 16 }}>
          {MANUALLY_OBSERVED_ENTRY_IDS.map((entryId) => {
            const entry = entriesById.get(entryId)
            if (!entry) {
              return null
            }

            return <ContentEntry key={entry.sys.id} entry={entry} observation="manual" />
          })}
        </div>
      </section>
    </>
  )
}
