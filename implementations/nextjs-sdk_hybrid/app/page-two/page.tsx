import { ControlPanel } from '@/components/ControlPanel'
import { CustomViewTracker } from '@/components/CustomViewTracker'
import { EntryCard } from '@/components/EntryCard'
import { loadPageEntries } from '@/lib/contentful'
import { toIdMap } from '@/lib/util'
import { PAGES } from 'e2e-web'
import Link from 'next/link'

export default async function PageTwo() {
  const entriesById = toIdMap(await loadPageEntries(PAGES.pageTwo.ids))
  const autoEntry = entriesById.get(PAGES.pageTwo.auto)
  const manualEntry = entriesById.get(PAGES.pageTwo.manual)

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
            {autoEntry ? (
              <EntryCard entry={autoEntry} />
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
            {manualEntry ? (
              <EntryCard entry={manualEntry} manualTracking />
            ) : (
              <p>Manual tracked entry is unavailable.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
