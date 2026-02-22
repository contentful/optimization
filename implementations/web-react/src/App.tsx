import { type JSX, useEffect, useMemo, useState } from 'react'
import { AnalyticsEventDisplay } from './components/AnalyticsEventDisplay'
import { ENV_CONFIG } from './config/env'
import { useOptimization } from './optimization/hooks/useOptimization'
import { useOptimizationState } from './optimization/hooks/useOptimizationState'
import { ContentEntry } from './sections/ContentEntry'
import { NestedContentEntry } from './sections/NestedContentEntry'
import { fetchEntries } from './services/contentfulClient'
import type { ContentfulEntry } from './types/contentful'

const AUTO_OBSERVED_ENTRY_IDS = [
  ENV_CONFIG.entries.nested,
  ENV_CONFIG.entries.mergeTag,
  ENV_CONFIG.entries.commonRegion,
  ENV_CONFIG.entries.commonDesktop,
  ENV_CONFIG.entries.personalized,
] as const

const MANUALLY_OBSERVED_ENTRY_IDS = [
  ENV_CONFIG.entries.abTest,
  ENV_CONFIG.entries.withCustomEvent,
  ENV_CONFIG.entries.identified,
] as const

const ENTRY_IDS = [...AUTO_OBSERVED_ENTRY_IDS, ...MANUALLY_OBSERVED_ENTRY_IDS] as const

function isIdentifiedProfile(profile: unknown): boolean {
  if (typeof profile !== 'object' || profile === null) {
    return false
  }

  const record = profile as { traits?: unknown }
  if (typeof record.traits !== 'object' || record.traits === null) {
    return false
  }

  const traits = record.traits as { identified?: unknown }
  return Boolean(traits.identified)
}

function hasEntries(entries: ContentfulEntry[]): boolean {
  return entries.length > 0
}

function toEntryMap(entries: ContentfulEntry[]): Map<string, ContentfulEntry> {
  return new Map(entries.map((entry) => [entry.sys.id, entry]))
}

function isConsentAccepted(consent: boolean | undefined): boolean {
  return consent === true
}

export default function App(): JSX.Element {
  const { sdk, isReady, error } = useOptimization()
  const { consent, profile, personalizations } = useOptimizationState(sdk?.states)

  const [entries, setEntries] = useState<ContentfulEntry[]>([])
  const [entriesError, setEntriesError] = useState<string | null>(null)

  useEffect(() => {
    if (!isReady || sdk === undefined) {
      return
    }

    void sdk.personalization.page({ properties: { url: 'app' } })
  }, [isReady, sdk])

  useEffect(() => {
    if (!isReady || sdk === undefined) {
      return
    }

    void fetchEntries(ENTRY_IDS)
      .then((nextEntries) => {
        setEntries(nextEntries)
        setEntriesError(
          nextEntries.length === 0
            ? 'No entries were loaded. Verify mock server and Contentful env configuration.'
            : null,
        )
      })
      .catch((fetchError: unknown) => {
        const message =
          fetchError instanceof Error ? fetchError.message : 'Unknown entry load error'
        setEntriesError(message)
      })
  }, [isReady, sdk])

  const isIdentified = useMemo(() => isIdentifiedProfile(profile), [profile])
  const entriesById = useMemo(() => toEntryMap(entries), [entries])
  const personalizationCount = useMemo(
    () => (Array.isArray(personalizations) ? personalizations.length : 0),
    [personalizations],
  )

  const handleIdentify = (): void => {
    if (!isReady || sdk === undefined) {
      return
    }

    void sdk.personalization.identify({ userId: 'charles', traits: { identified: true } })
  }

  const handleReset = (): void => {
    if (!isReady || sdk === undefined) {
      return
    }

    sdk.reset()
    void sdk.personalization.page({ properties: { url: 'app' } })
  }

  const handleConsent = (accepted: boolean): void => {
    if (!isReady || sdk === undefined) {
      return
    }

    sdk.consent(accepted)
  }

  if (error) {
    return <p>{error.message}</p>
  }

  if (!isReady || sdk === undefined) {
    return <p>Loading SDK...</p>
  }

  if (entriesError) {
    return <p>{entriesError}</p>
  }

  if (!hasEntries(entries)) {
    return <p>Loading entries...</p>
  }

  return (
    <main style={{ display: 'grid', gap: 24 }}>
      <section id="utility-panel">
        <h2>Utilities</h2>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isConsentAccepted(consent) ? (
            <button
              data-testid="unconsent-button"
              onClick={() => {
                handleConsent(false)
              }}
              type="button"
            >
              Reject Consent
            </button>
          ) : (
            <button
              data-testid="consent-button"
              onClick={() => {
                handleConsent(true)
              }}
              type="button"
            >
              Accept Consent
            </button>
          )}

          {!isIdentified ? (
            <button data-testid="identify-button" onClick={handleIdentify} type="button">
              Identify
            </button>
          ) : (
            <button data-testid="reset-button" onClick={handleReset} type="button">
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

      <AnalyticsEventDisplay />
    </main>
  )
}
