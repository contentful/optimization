import { useOptimizationContext } from '@contentful/optimization-react-web'
import { PAGES } from 'e2e-web'
import { type JSX, useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useOutletContext } from 'react-router-dom'
import { AnalyticsEventDisplay } from './components/AnalyticsEventDisplay'
import { fetchEntries, getContentfulConfigError } from './services/contentfulClient'
import type { ContentEntry } from './types/contentful'

interface OutletContext {
  onToggleGlobalLiveUpdates: () => void
}

export interface AppOutletContext {
  entriesById: Map<string, ContentEntry>
  liveUpdatesBaselineEntry: ContentEntry | undefined
  selectedOptimizationCount: number
  onToggleGlobalLiveUpdates: () => void
}

function toEntryMap(entries: ContentEntry[]): Map<string, ContentEntry> {
  return new Map(entries.map((entry) => [entry.sys.id, entry]))
}

export default function App(): JSX.Element {
  const { sdk, error } = useOptimizationContext()
  const { onToggleGlobalLiveUpdates } = useOutletContext<OutletContext>()

  const [selectedOptimizationCount, setSelectedOptimizationCount] = useState(0)
  const [entries, setEntries] = useState<ContentEntry[]>([])

  useEffect(() => {
    if (sdk === undefined) {
      return
    }

    const selectedOptSub = sdk.states.selectedOptimizations.subscribe((value) => {
      setSelectedOptimizationCount(Array.isArray(value) ? value.length : 0)
    })

    return () => {
      selectedOptSub.unsubscribe()
    }
  }, [sdk])

  useEffect(() => {
    if (sdk === undefined) {
      return
    }

    const configError = getContentfulConfigError()
    if (configError) {
      return
    }

    void fetchEntries(PAGES.home.ids).then((nextEntries) => {
      setEntries(nextEntries)
    })
  }, [sdk])

  const entriesById = useMemo(() => toEntryMap(entries), [entries])
  const liveUpdatesBaselineEntry = entriesById.get(PAGES.home.liveUpdates)

  if (error) {
    return <p data-testid="sdk-error">{error.message}</p>
  }

  if (sdk === undefined) {
    return <p data-testid="sdk-loading">Loading SDK...</p>
  }

  const appOutletContext: AppOutletContext = {
    entriesById,
    liveUpdatesBaselineEntry,
    selectedOptimizationCount,
    onToggleGlobalLiveUpdates,
  }

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <Link data-testid="link-home" to={PAGES.home.path}>
          Home
        </Link>
        <Link data-testid="link-page-two" to={PAGES.pageTwo.path}>
          Page Two
        </Link>
      </nav>

      <div className="app-body">
        <aside className="app-sidebar">
          <AnalyticsEventDisplay />
        </aside>
        <main className="app-main">
          <Outlet context={appOutletContext} />
        </main>
      </div>
    </div>
  )
}
