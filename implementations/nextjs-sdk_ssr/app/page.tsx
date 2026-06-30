import { ControlPanel } from '@/components/ControlPanel'
import { EntryCard } from '@/components/EntryCard'
import { optimization } from '@/lib/optimization'
import { CLICK_SCENARIOS, PAGES } from 'e2e-web'

export default async function Home() {
  const [serverState, liveUpdates, auto, manual] = await Promise.all([
    optimization.getServerState(),
    optimization.getEntry(PAGES.home.liveUpdates),
    optimization.getEntries(PAGES.home.auto),
    optimization.getEntries(PAGES.home.manual),
  ])

  const liveUpdatesEntry = liveUpdates?.baselineEntry

  return (
    <>
      <div className="page-header">
        <h1>Next.js SDK SSR</h1>
        <p className="page-header__subtitle">
          Reference implementation of @contentful/optimization-nextjs (SSR entry resolution +
          client-side tracking)
        </p>
      </div>

      <ControlPanel serverState={serverState} />

      <section className="page-section" data-testid="live-updates-section">
        <header className="page-section__header">
          <h2>Live Updates</h2>
          <p>
            Toggle global live updates and identify the user to verify how entries update. Optional
            per-component control is available through the <code>liveUpdates</code> prop.
          </p>
        </header>
        {liveUpdatesEntry ? (
          <div className="sections-grid" data-testid="live-updates-examples">
            <section data-testid="live-updates-default">
              <h3>Default (inherits global setting)</h3>
              <EntryCard entry={liveUpdatesEntry} testId="live-default" />
            </section>

            <section data-testid="live-updates-enabled">
              <h3>Always On (liveUpdates=true)</h3>
              <EntryCard entry={liveUpdatesEntry} liveUpdates={true} testId="live-enabled" />
            </section>

            <section data-testid="live-updates-locked">
              <h3>Locked (liveUpdates=false)</h3>
              <EntryCard entry={liveUpdatesEntry} liveUpdates={false} testId="live-locked" />
            </section>
          </div>
        ) : (
          <p data-testid="live-updates-loading">Loading live updates entries...</p>
        )}
      </section>

      <div className="sections-grid sections-grid--split">
        <section className="page-section" data-testid="auto-observed-section">
          <header className="page-section__header">
            <h2>Auto Observed Entries</h2>
          </header>
          <div id="auto-observed" className="entry-grid">
            {auto.map((entry) => (
              <EntryCard
                key={entry.baselineEntry.sys.id}
                entry={entry}
                clickScenario={CLICK_SCENARIOS[entry.baselineEntry.sys.id]}
                manualTracking={false}
              />
            ))}
          </div>
        </section>

        <section className="page-section" data-testid="manually-observed-section">
          <header className="page-section__header">
            <h2>Manually Observed Entries</h2>
          </header>
          <div id="manually-observed" className="entry-grid">
            {manual.map((entry) => (
              <EntryCard key={entry.baselineEntry.sys.id} entry={entry} manualTracking={true} />
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
