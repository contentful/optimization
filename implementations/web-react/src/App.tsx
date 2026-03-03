import type { Profile } from '@contentful/optimization-web/api-schemas'
import { type JSX, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnalyticsEventDisplay } from './components/AnalyticsEventDisplay'
import {
  ENTRY_IDS,
  LIVE_UPDATES_ENTRY_ID,
  PAGE_TWO_AUTO_ENTRY_ID,
  PAGE_TWO_MANUAL_ENTRY_ID,
} from './config/entries'
import { HOME_PATH, PAGE_TWO_PATH } from './config/routes'
import { useOptimization } from './optimization/hooks/useOptimization'
import { useOptimizationState } from './optimization/hooks/useOptimizationState'
import { HomePage } from './pages/HomePage'
import { PageTwoPage } from './pages/PageTwoPage'
import { fetchEntries, getContentfulConfigError } from './services/contentfulClient'
import type { ContentfulEntry } from './types/contentful'

interface AppProps {
  globalLiveUpdates: boolean
  onToggleGlobalLiveUpdates: () => void
}

function isIdentifiedProfile(profile: Profile | undefined): boolean {
  if (profile === undefined) {
    return false
  }

  const { traits } = profile
  return Boolean(traits.identified)
}

function hasEntries(entries: ContentfulEntry[]): boolean {
  return entries.length > 0
}

function toEntryMap(entries: ContentfulEntry[]): Map<string, ContentfulEntry> {
  return new Map(entries.map((entry) => [entry.sys.id, entry]))
}

export default function App({
  globalLiveUpdates,
  onToggleGlobalLiveUpdates,
}: AppProps): JSX.Element {
  const location = useLocation()
  const { sdk, isReady, error } = useOptimization()
  const { consent, profile, personalizations } = useOptimizationState(sdk?.states)

  const [entries, setEntries] = useState<ContentfulEntry[]>([])
  const [entriesError, setEntriesError] = useState<string | null>(null)

  useEffect(() => {
    if (!isReady || sdk === undefined) {
      return
    }

    void sdk.page({ properties: { url: location.pathname } })
  }, [isReady, location.pathname, sdk])

  useEffect(() => {
    if (!isReady || sdk === undefined) {
      return
    }

    const configError = getContentfulConfigError()
    if (configError) {
      setEntriesError(configError)
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
  const liveUpdatesBaselineEntry = entriesById.get(LIVE_UPDATES_ENTRY_ID)
  const hasPageTwoEntries =
    entriesById.has(PAGE_TWO_AUTO_ENTRY_ID) && entriesById.has(PAGE_TWO_MANUAL_ENTRY_ID)

  const handleIdentify = (): void => {
    if (!isReady || sdk === undefined) {
      return
    }

    void sdk.identify({ userId: 'charles', traits: { identified: true } })
  }

  const handleReset = (): void => {
    if (!isReady || sdk === undefined) {
      return
    }

    sdk.reset()
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

  if (!liveUpdatesBaselineEntry) {
    return <p>Live updates baseline entry is missing from fetched entries.</p>
  }

  if (!hasPageTwoEntries) {
    return <p>Page Two demo entries are missing from fetched entries.</p>
  }

  return (
    <main style={{ display: 'grid', gap: 24 }}>
      <nav style={{ display: 'flex', gap: 12 }}>
        <Link data-testid="link-home" to={HOME_PATH}>
          Home
        </Link>
        <Link data-testid="link-page-two" to={PAGE_TWO_PATH}>
          Go to Page Two
        </Link>
      </nav>

      <Routes>
        <Route
          path={HOME_PATH}
          element={
            <HomePage
              consent={consent}
              entriesById={entriesById}
              globalLiveUpdates={globalLiveUpdates}
              isIdentified={isIdentified}
              liveUpdatesBaselineEntry={liveUpdatesBaselineEntry}
              personalizationCount={personalizationCount}
              onConsentChange={handleConsent}
              onIdentify={handleIdentify}
              onReset={handleReset}
              onToggleGlobalLiveUpdates={onToggleGlobalLiveUpdates}
            />
          }
        />
        <Route
          path={PAGE_TWO_PATH}
          element={
            <PageTwoPage consent={consent} entriesById={entriesById} isIdentified={isIdentified} />
          }
        />
        <Route path="*" element={<Navigate replace to={HOME_PATH} />} />
      </Routes>

      <AnalyticsEventDisplay />
    </main>
  )
}
