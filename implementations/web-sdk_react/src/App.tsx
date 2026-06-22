import { pages } from 'e2e-web/src/fixtures'
import { type JSX, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnalyticsEventDisplay } from './components/AnalyticsEventDisplay'
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

    void fetchEntries(pages.home.ids)
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
  const liveUpdatesBaselineEntry = entriesById.get(pages.home.liveUpdates)
  const hasPageTwoEntries =
    entriesById.has(pages.pageTwo.auto) && entriesById.has(pages.pageTwo.manual)

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
        <Link data-testid="link-home" to={pages.home.path}>
          Home
        </Link>
        <Link data-testid="link-page-two" to={pages.pageTwo.path}>
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
              path={pages.home.path}
              element={
                <HomePage
                  entriesById={entriesById}
                  liveUpdatesBaselineEntry={liveUpdatesBaselineEntry}
                  onToggleGlobalLiveUpdates={onToggleGlobalLiveUpdates}
                />
              }
            />
            <Route
              path={pages.pageTwo.path}
              element={
                <PageTwoPage
                  entriesById={entriesById}
                  onToggleGlobalLiveUpdates={onToggleGlobalLiveUpdates}
                />
              }
            />
            <Route path="*" element={<Navigate replace to={pages.home.path} />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
