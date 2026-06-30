import { ControlPanel } from '@/components/ControlPanel'
import { CustomViewTracker } from '@/components/CustomViewTracker'
import { EntryCard } from '@/components/EntryCard'
import { loadPageData } from '@/lib/resolution'
import { PAGES } from 'e2e-web'
import Link from 'next/link'

export default async function PageTwo() {
  const { resolvedById } = await loadPageData(PAGES.pageTwo.ids)

  const auto = resolvedById.get(PAGES.pageTwo.auto)
  const manual = resolvedById.get(PAGES.pageTwo.manual)

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
            {auto ? (
              <EntryCard
                baselineEntry={auto.baselineEntry}
                resolvedData={auto.resolvedData}
                resolvedEntry={auto.resolvedEntry}
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
            {manual ? (
              <EntryCard
                baselineEntry={manual.baselineEntry}
                resolvedData={manual.resolvedData}
                resolvedEntry={manual.resolvedEntry}
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
