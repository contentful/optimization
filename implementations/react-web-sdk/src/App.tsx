import { useOptimizationContext } from '@contentful/optimization-react-web'
import type { Profile } from '@contentful/optimization-react-web/api-schemas'
import { type JSX, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useOutletContext } from 'react-router-dom'
import {
  ENTRY_IDS,
  LIVE_UPDATES_ENTRY_ID,
  PAGE_TWO_AUTO_ENTRY_ID,
  PAGE_TWO_MANUAL_ENTRY_ID,
} from './config/entries'
import { HOME_PATH, PAGE_TWO_PATH } from './config/routes'
import { HomePage } from './pages/HomePage'
import { PageTwoPage } from './pages/PageTwoPage'
import { fetchEntries, getContentfulConfigError } from './services/contentfulClient'
import type { ContentfulEntry } from './types/contentful'

interface OutletContext {
  globalLiveUpdates: boolean
  onToggleGlobalLiveUpdates: () => void
}

function isIdentifiedProfile(profile: Profile | undefined): boolean {
  if (profile === undefined) {
    return false
  }

  return Boolean(profile.traits.identified)
}

function hasEntries(entries: ContentfulEntry[]): boolean {
  return entries.length > 0
}

function toEntryMap(entries: ContentfulEntry[]): Map<string, ContentfulEntry> {
  return new Map(entries.map((entry) => [entry.sys.id, entry]))
}

export default function App(): JSX.Element {
  const { sdk, isReady, error } = useOptimizationContext()
  const { onToggleGlobalLiveUpdates } = useOutletContext<OutletContext>()

  const [consent, setConsent] = useState<boolean | undefined>(undefined)
  const [profile, setProfile] = useState<Profile | undefined>(undefined)
  const [selectedOptimizationCount, setSelectedOptimizationCount] = useState(0)
  const [entries, setEntries] = useState<ContentfulEntry[]>([])
  const [entriesError, setEntriesError] = useState<string | null>(null)

  useEffect(() => {
    if (!sdk || !isReady) {
      return
    }

    const consentSub = sdk.states.consent.subscribe((value: boolean | undefined) => {
      setConsent(value)
    })

    const profileSub = sdk.states.profile.subscribe((value: Profile | undefined) => {
      setProfile(value)
    })

    const selectedOptSub = sdk.states.selectedOptimizations.subscribe((value) => {
      setSelectedOptimizationCount(Array.isArray(value) ? value.length : 0)
    })

    return () => {
      consentSub.unsubscribe()
      profileSub.unsubscribe()
      selectedOptSub.unsubscribe()
    }
  }, [isReady, sdk])

  useEffect(() => {
    if (!sdk || !isReady || consent !== true || profile === undefined) {
      return
    }

    const sub = sdk.states.flag('boolean').subscribe(() => undefined)

    return () => {
      sub.unsubscribe()
    }
  }, [consent, profile?.id, isReady, sdk])

  useEffect(() => {
    if (!sdk || !isReady) {
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
  const liveUpdatesBaselineEntry = entriesById.get(LIVE_UPDATES_ENTRY_ID)
  const hasPageTwoEntries =
    entriesById.has(PAGE_TWO_AUTO_ENTRY_ID) && entriesById.has(PAGE_TWO_MANUAL_ENTRY_ID)

  if (error) {
    return <p>{error.message}</p>
  }

  if (!sdk || !isReady) {
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

  const handleIdentify = (): void => {
    void sdk.identify({ userId: 'charles', traits: { identified: true } })
  }

  const handleReset = (): void => {
    sdk.reset()
  }

  const handleConsent = (accepted: boolean): void => {
    sdk.consent(accepted)
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
              isIdentified={isIdentified}
              liveUpdatesBaselineEntry={liveUpdatesBaselineEntry}
              selectedOptimizationCount={selectedOptimizationCount}
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
    </main>
  )
}
