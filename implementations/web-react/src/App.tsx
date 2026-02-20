import { type JSX, useEffect, useMemo, useState } from 'react'
import { AnalyticsEventDisplay } from './components/AnalyticsEventDisplay'
import { ENV_CONFIG } from './config/env'
import { useOptimization } from './optimization/hooks/useOptimization'
import { useOptimizationState } from './optimization/hooks/useOptimizationState'
import { ContentEntry } from './sections/ContentEntry'
import { NestedContentEntry } from './sections/NestedContentEntry'
import { fetchEntries } from './services/contentfulClient'
import type { ContentfulEntry } from './types/contentful'

const ENTRY_IDS = [
  ENV_CONFIG.entries.mergeTag,
  ENV_CONFIG.entries.commonRegion,
  ENV_CONFIG.entries.commonDesktop,
  ENV_CONFIG.entries.personalized,
  ENV_CONFIG.entries.abTest,
  ENV_CONFIG.entries.withCustomEvent,
  ENV_CONFIG.entries.identified,
  ENV_CONFIG.entries.nested,
] as const

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

function renderEntry(entry: ContentfulEntry): JSX.Element {
  if (entry.sys.contentType.sys.id === 'nestedContent') {
    return <NestedContentEntry key={entry.sys.id} entry={entry} />
  }

  return <ContentEntry key={entry.sys.id} entry={entry} />
}

export default function App(): JSX.Element {
  const { sdk, isReady, error } = useOptimization()
  const { profile } = useOptimizationState(sdk?.states)

  const [entries, setEntries] = useState<ContentfulEntry[]>([])
  const [entriesError, setEntriesError] = useState<string | null>(null)

  useEffect(() => {
    if (!isReady || sdk === undefined) {
      return
    }

    void sdk.personalization.page({ properties: { url: 'app' } })
  }, [isReady, sdk])

  useEffect(() => {
    if (!isReady || sdk === undefined || profile === undefined) {
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
  }, [isReady, profile, sdk])

  const isIdentified = useMemo(() => isIdentifiedProfile(profile), [profile])

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
    <main>
      <h1>Optimization SDK - React Web Reference</h1>

      <div style={{ display: 'flex', gap: 8 }}>
        {!isIdentified ? (
          <button data-testid="identify-button" onClick={handleIdentify} type="button">
            Identify
          </button>
        ) : (
          <button data-testid="reset-button" onClick={handleReset} type="button">
            Reset
          </button>
        )}
      </div>

      <section>{entries.map(renderEntry)}</section>

      <AnalyticsEventDisplay />
    </main>
  )
}
