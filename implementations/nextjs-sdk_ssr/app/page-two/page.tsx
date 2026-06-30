import { ControlPanel } from '@/components/ControlPanel'
import { CustomViewTracker } from '@/components/CustomViewTracker'
import { EntryCard } from '@/components/EntryCard'
import { loadPageEntries } from '@/lib/contentful'
import { loadOptimizationData, resolveOptimizedEntries } from '@/lib/resolution'
import { PAGES } from 'e2e-web'
import { cookies } from 'next/headers'
import Link from 'next/link'

export default async function PageTwo() {
  const cookieStore = await cookies()

  const [entries, optimizationData] = await Promise.all([
    loadPageEntries(PAGES.pageTwo.ids),
    loadOptimizationData(cookieStore),
  ])

  const { entriesById, resolvedById } = await resolveOptimizedEntries(
    entries,
    optimizationData?.selectedOptimizations,
  )

  const autoEntry = entriesById.get(PAGES.pageTwo.auto)
  const manualEntry = entriesById.get(PAGES.pageTwo.manual)
  const autoResolved = autoEntry ? resolvedById.get(PAGES.pageTwo.auto) : undefined
  const manualResolved = manualEntry ? resolvedById.get(PAGES.pageTwo.manual) : undefined

  return (
    <section data-testid="page-two-view">
      <div className="page-header">
        <Link data-testid="link-back-home" href={PAGES.home.path}>
          Back to Home
        </Link>
        <h1>Page Two</h1>
      </div>

      <CustomViewTracker componentId="page-two-hero" />
      <ControlPanel demoCTA />

      <div className="sections-grid sections-grid--split" data-testid="page-two-optimization">
        <section className="page-section">
          <header className="page-section__header">
            <h2>Auto-observed</h2>
          </header>
          <div className="entry-grid">
            {autoEntry && autoResolved ? (
              <EntryCard
                baselineEntry={autoEntry}
                resolvedData={autoResolved}
                manualTracking={false}
              />
            ) : (
              <p>Auto tracked entry is unavailable.</p>
            )}
          </div>
        </section>

        <section className="page-section">
          <header className="page-section__header">
            <h2>Manually-observed</h2>
          </header>
          <div className="entry-grid">
            {manualEntry && manualResolved ? (
              <EntryCard
                baselineEntry={manualEntry}
                resolvedData={manualResolved}
                manualTracking={true}
              />
            ) : (
              <p>Manual tracked entry is unavailable.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
