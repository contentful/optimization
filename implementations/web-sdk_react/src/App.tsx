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
import { HomePage } from './pages/HomePage'
import { PageTwoPage } from './pages/PageTwoPage'
import { fetchEntries, getContentfulConfigError } from './services/contentfulClient'
import type { ContentfulEntry } from './types/contentful'

interface AppProps {
  onToggleGlobalLiveUpdates: () => void
}

function toEntryMap(entries: ContentfulEntry[]): Map<string, ContentfulEntry> {
  return new Map(entries.map((entry) => [entry.sys.id, entry]))
}

export default function App({ onToggleGlobalLiveUpdates }: AppProps): JSX.Element {
  const location = useLocation()
  const { sdk, error } = useOptimization()

  const [entries, setEntries] = useState<ContentfulEntry[]>([])
  const [entriesError, setEntriesError] = useState<string | null>(null)

  useEffect(() => {
    if (sdk === undefined) {
      return
    }

    void sdk.page({ properties: { url: location.pathname } })
  }, [location.pathname, sdk])

  useEffect(() => {
    if (sdk === undefined) {
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
  }, [sdk])

  const entriesById = useMemo(() => toEntryMap(entries), [entries])
  const liveUpdatesBaselineEntry = entriesById.get(LIVE_UPDATES_ENTRY_ID)
  const hasPageTwoEntries =
    entriesById.has(PAGE_TWO_AUTO_ENTRY_ID) && entriesById.has(PAGE_TWO_MANUAL_ENTRY_ID)

  if (error) {
    return <p>{error.message}</p>
  }

  if (sdk === undefined) {
    return <p>Loading SDK...</p>
  }

  if (entriesError) {
    return <p>{entriesError}</p>
  }

  if (entries.length === 0) {
    return <p>Loading entries...</p>
  }

  if (!liveUpdatesBaselineEntry) {
    return <p>Live updates baseline entry is missing from fetched entries.</p>
  }

  if (!hasPageTwoEntries) {
    return <p>Page Two demo entries are missing from fetched entries.</p>
  }

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <Link data-testid="link-home" to={HOME_PATH}>
          Home
        </Link>
        <Link data-testid="link-page-two" to={PAGE_TWO_PATH}>
          Page Two
        </Link>
      </nav>

      <div className="app-body">
        <aside className="app-sidebar">
          <AnalyticsEventDisplay />
        </aside>
        <main className="app-main">
          <Routes>
            <Route
              path={HOME_PATH}
              element={
                <HomePage
                  entriesById={entriesById}
                  liveUpdatesBaselineEntry={liveUpdatesBaselineEntry}
                  onToggleGlobalLiveUpdates={onToggleGlobalLiveUpdates}
                />
              }
            />
            <Route
              path={PAGE_TWO_PATH}
              element={
                <PageTwoPage
                  entriesById={entriesById}
                  onToggleGlobalLiveUpdates={onToggleGlobalLiveUpdates}
                />
              }
            />
            <Route path="*" element={<Navigate replace to={HOME_PATH} />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
