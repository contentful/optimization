import { ControlPanel } from '@/components/ControlPanel'
import { EntryCard } from '@/components/EntryCard'
import { LiveEntryCard } from '@/components/LiveEntryCard'
import { appConfig } from '@/lib/config'
import { loadPageEntries } from '@/lib/contentful'
import { optimization } from '@/lib/optimization'
import { getAppConsent, toIdMap } from '@/lib/util'
import { getNextjsServerOptimizationData } from '@contentful/optimization-nextjs/server'
import { CLICK_SCENARIOS, PAGES } from 'e2e-web'
import { cookies, headers } from 'next/headers'

export default async function Home() {
  const cookieStore = await cookies()
  const headerStore = await headers()

  const [entries, optimizationData] = await Promise.all([
    loadPageEntries(PAGES.home.ids),
    getAppConsent(cookieStore)
      ? getNextjsServerOptimizationData(optimization, {
          consent: { events: true, persistence: true },
          cookies: cookieStore,
          headers: headerStore,
          locale: appConfig.locale,
        }).then(({ data }) => data)
      : undefined,
  ])

  const entriesById = toIdMap(entries)
  const resolvedById = new Map(
    entries.map((entry) => [
      entry.sys.id,
      optimization.resolveOptimizedEntry(entry, optimizationData?.selectedOptimizations),
    ]),
  )

  const profile = optimizationData?.profile
  const getMergeTagValue = (entry: unknown): string | undefined =>
    optimization.getMergeTagValue(entry as never, profile)

  const liveUpdatesEntry = entriesById.get(PAGES.home.liveUpdates)

  return (
    <>
      <div className="page-header">
        <h1>Next.js SDK SSR</h1>
        <p className="page-header__subtitle">
          Reference implementation of @contentful/optimization-nextjs (SSR entry resolution +
          client-side tracking)
        </p>
      </div>

      <ControlPanel />

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
              <LiveEntryCard entry={liveUpdatesEntry} testId="live-default" />
            </section>

            <section data-testid="live-updates-enabled">
              <h3>Always On (liveUpdates=true)</h3>
              <LiveEntryCard entry={liveUpdatesEntry} liveUpdates={true} testId="live-enabled" />
            </section>

            <section data-testid="live-updates-locked">
              <h3>Locked (liveUpdates=false)</h3>
              <LiveEntryCard entry={liveUpdatesEntry} liveUpdates={false} testId="live-locked" />
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
            {PAGES.home.auto.flatMap((id) => {
              const entry = entriesById.get(id)
              const resolvedData = resolvedById.get(id)
              if (!entry || !resolvedData) return []
              return [
                <EntryCard
                  key={id}
                  baselineEntry={entry}
                  clickScenario={CLICK_SCENARIOS[id]}
                  getMergeTagValue={getMergeTagValue}
                  manualTracking={false}
                  resolvedData={resolvedData}
                />,
              ]
            })}
          </div>
        </section>

        <section className="page-section" data-testid="manually-observed-section">
          <header className="page-section__header">
            <h2>Manually Observed Entries</h2>
          </header>
          <div id="manually-observed" className="entry-grid">
            {PAGES.home.manual.flatMap((id) => {
              const entry = entriesById.get(id)
              const resolvedData = resolvedById.get(id)
              if (!entry || !resolvedData) return []
              return [
                <EntryCard
                  key={id}
                  baselineEntry={entry}
                  getMergeTagValue={getMergeTagValue}
                  manualTracking={true}
                  resolvedData={resolvedData}
                />,
              ]
            })}
          </div>
        </section>
      </div>
    </>
  )
}
