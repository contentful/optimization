import { ControlPanel } from '@/components/ControlPanel'
import { CustomViewTracker } from '@/components/CustomViewTracker'
import { EntryCard } from '@/components/EntryCard'
import { optimization } from '@/lib/optimization'
import { PAGES } from 'e2e-web'
import Link from 'next/link'

export default async function PageTwo() {
  const [{ hasConsent, isIdentified, activeOptimizationsCount }, [auto, manual]] =
    await Promise.all([
      optimization.getServerState(),
      optimization.getEntries([PAGES.pageTwo.auto, PAGES.pageTwo.manual]),
    ])

  return (
    <section data-testid="page-two-view">
      <div className="page-header">
        <Link data-testid="link-back-home" href={PAGES.home.path}>
          Back to Home
        </Link>
        <h1>Page Two</h1>
      </div>

      <CustomViewTracker componentId="page-two-hero" />
      <ControlPanel
        demoCTA
        initialConsent={hasConsent}
        initialIsIdentified={isIdentified}
        initialActiveOptimizationsCount={activeOptimizationsCount}
      />

      <div className="sections-grid sections-grid--split" data-testid="page-two-optimization">
        <section className="page-section">
          <header className="page-section__header">
            <h2>Auto-observed</h2>
          </header>
          <div className="entry-grid">
            {auto ? (
              <EntryCard entry={auto} manualTracking={false} />
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
              <EntryCard entry={manual} manualTracking={true} />
            ) : (
              <p>Manual tracked entry is unavailable.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
