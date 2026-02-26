import type { JSX } from 'react'
import { AUTO_OBSERVED_ENTRY_IDS, MANUALLY_OBSERVED_ENTRY_IDS } from '../config/entries'
import { useLiveUpdates } from '../optimization/liveUpdates/LiveUpdatesContext'
import { ContentEntry } from '../sections/ContentEntry'
import { LiveUpdatesSection } from '../sections/LiveUpdatesSection'
import { NestedContentEntry } from '../sections/NestedContentEntry'
import type { ContentfulEntry } from '../types/contentful'

interface HomePageProps {
  consent: boolean | undefined
  entriesById: Map<string, ContentfulEntry>
  globalLiveUpdates: boolean
  isIdentified: boolean
  liveUpdatesBaselineEntry: ContentfulEntry
  personalizationCount: number
  onConsentChange: (accepted: boolean) => void
  onIdentify: () => void
  onReset: () => void
  onToggleGlobalLiveUpdates: () => void
}

function isConsentAccepted(consent: boolean | undefined): boolean {
  return consent === true
}

export function HomePage({
  consent,
  entriesById,
  globalLiveUpdates,
  isIdentified,
  liveUpdatesBaselineEntry,
  personalizationCount,
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

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isConsentAccepted(consent) ? (
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
              liveUpdatesContext?.togglePreviewPanel()
            }}
            type="button"
          >
            {isPreviewPanelOpen ? 'Close Preview Panel' : 'Open Preview Panel'}
          </button>
        </div>

        <p data-testid="consent-status">Consent: {String(consent)}</p>
        <p data-testid="personalizations-count">Personalizations: {personalizationCount}</p>
        <p data-testid="identified-status">{isIdentified ? 'Yes' : 'No'}</p>
        <p data-testid="global-live-updates-status">{globalLiveUpdates ? 'ON' : 'OFF'}</p>
        <p data-testid="preview-panel-status">{isPreviewPanelOpen ? 'Open' : 'Closed'}</p>
      </section>

      <section>
        <h2>Live Updates</h2>
        <LiveUpdatesSection baselineEntry={liveUpdatesBaselineEntry} />
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

            return <ContentEntry key={entry.sys.id} entry={entry} observation="auto" />
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
