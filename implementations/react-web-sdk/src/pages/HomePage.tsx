import { useLiveUpdates } from '@contentful/optimization-react-web'
import type { JSX } from 'react'
import { AnalyticsEventDisplay } from '../components/AnalyticsEventDisplay'
import { AUTO_OBSERVED_ENTRY_IDS, MANUALLY_OBSERVED_ENTRY_IDS } from '../config/entries'
import { type EntryClickScenario, ContentEntry } from '../sections/ContentEntry'
import { LiveUpdatesExampleEntry } from '../sections/LiveUpdatesExampleEntry'
import { NestedContentEntry } from '../sections/NestedContentEntry'
import type { ContentfulEntry } from '../types/contentful'

interface HomePageProps {
  consent: boolean | undefined
  entriesById: Map<string, ContentfulEntry>
  isIdentified: boolean
  liveUpdatesBaselineEntry: ContentfulEntry
  selectedOptimizationCount: number
  onConsentChange: (accepted: boolean) => void
  onIdentify: () => void
  onReset: () => void
  onToggleGlobalLiveUpdates: () => void
}

const AUTO_OBSERVED_CLICK_SCENARIO_BY_ENTRY_ID: Readonly<Record<string, EntryClickScenario>> = {
  '4ib0hsHWoSOnCVdDkizE8d': 'direct',
  xFwgG3oNaOcjzWiGe4vXo: 'descendant',
  '2Z2WLOx07InSewC3LUB3eX': 'ancestor',
}

export function HomePage({
  consent,
  entriesById,
  isIdentified,
  liveUpdatesBaselineEntry,
  selectedOptimizationCount,
  onConsentChange,
  onIdentify,
  onReset,
  onToggleGlobalLiveUpdates,
}: HomePageProps): JSX.Element {
  const { globalLiveUpdates, previewPanelVisible, setPreviewPanelVisible } = useLiveUpdates()

  return (
    <>
      <section id="utility-panel">
        <h2>Utilities</h2>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {consent === true ? (
            <button
              data-testid="unconsent-button"
              onClick={() => {
                onConsentChange(false)
              }}
              type="button"
            >
              Reject Consent
            </button>
          ) : (
            <button
              data-testid="consent-button"
              onClick={() => {
                onConsentChange(true)
              }}
              type="button"
            >
              Accept Consent
            </button>
          )}

          {!isIdentified ? (
            <button data-testid="live-updates-identify-button" onClick={onIdentify} type="button">
              Identify
            </button>
          ) : (
            <button data-testid="live-updates-reset-button" onClick={onReset} type="button">
              Reset Profile
            </button>
          )}

          <button
            data-testid="toggle-global-live-updates-button"
            onClick={onToggleGlobalLiveUpdates}
            type="button"
          >
            {`Global: ${globalLiveUpdates ? 'ON' : 'OFF'}`}
          </button>

          <button
            data-testid="simulate-preview-panel-button"
            onClick={() => {
              setPreviewPanelVisible(!previewPanelVisible)
            }}
            type="button"
          >
            {previewPanelVisible ? 'Close Preview Panel' : 'Open Preview Panel'}
          </button>
        </div>

        <p data-testid="consent-status">Consent: {String(consent)}</p>
        <p data-testid="selected-optimizations-count">
          Selected Optimizations: {selectedOptimizationCount}
        </p>
        <p data-testid="identified-status">{isIdentified ? 'Yes' : 'No'}</p>
        <p data-testid="global-live-updates-status">{globalLiveUpdates ? 'ON' : 'OFF'}</p>
        <p data-testid="preview-panel-status">{previewPanelVisible ? 'Open' : 'Closed'}</p>
      </section>

      <section>
        <h2>Live Updates</h2>
        <p>
          Toggle global live updates and identify the user to verify how entries update. Optional
          per-component control is available through the <code>liveUpdates</code> prop.
        </p>
        <div data-testid="live-updates-examples" style={{ display: 'grid', gap: 16 }}>
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

      <AnalyticsEventDisplay />
    </>
  )
}
