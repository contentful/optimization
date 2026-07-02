import { ControlPanel } from '@/components/ControlPanel'
import { CustomViewTracker } from '@/components/CustomViewTracker'
import { EntryCard } from '@/components/EntryCard'
import { loadPageEntries } from '@/lib/contentful'
import { getServerOptimizationData, optimization } from '@/lib/optimization'
import { toIdMap } from '@/lib/util'
import { NextjsOptimizationState } from '@contentful/optimization-nextjs/client'
import { PAGES } from 'e2e-web'
import Link from 'next/link'

export default async function PageTwo() {
  const [entries, optimizationData] = await Promise.all([
    loadPageEntries(PAGES.pageTwo.ids),
    getServerOptimizationData(),
  ])

  const entriesById = toIdMap(entries)
  const autoEntry = entriesById.get(PAGES.pageTwo.auto)
  const manualEntry = entriesById.get(PAGES.pageTwo.manual)
  const autoResolved = autoEntry
    ? optimization.resolveOptimizedEntry(autoEntry, optimizationData?.selectedOptimizations)
    : undefined
  const manualResolved = manualEntry
    ? optimization.resolveOptimizedEntry(manualEntry, optimizationData?.selectedOptimizations)
    : undefined

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
      <NextjsOptimizationState data={optimizationData} />

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
