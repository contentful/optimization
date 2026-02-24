import type { JSX } from 'react'
import { AUTO_OBSERVED_ENTRY_IDS, MANUALLY_OBSERVED_ENTRY_IDS } from '../config/entries'
import { ContentEntry } from '../sections/ContentEntry'
import { NestedContentEntry } from '../sections/NestedContentEntry'
import type { ContentfulEntry } from '../types/contentful'

interface HomePageProps {
  consent: boolean | undefined
  entriesById: Map<string, ContentfulEntry>
  isIdentified: boolean
  personalizationCount: number
  onConsentChange: (accepted: boolean) => void
  onIdentify: () => void
  onReset: () => void
}

function isConsentAccepted(consent: boolean | undefined): boolean {
  return consent === true
}

export function HomePage({
  consent,
  entriesById,
  isIdentified,
  personalizationCount,
  onConsentChange,
  onIdentify,
  onReset,
}: HomePageProps): JSX.Element {
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
            <button data-testid="identify-button" onClick={onIdentify} type="button">
              Identify
            </button>
          ) : (
            <button data-testid="reset-button" onClick={onReset} type="button">
              Reset Profile
            </button>
          )}
        </div>

        <p data-testid="consent-status">Consent: {String(consent)}</p>
        <p data-testid="personalizations-count">Personalizations: {personalizationCount}</p>
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
