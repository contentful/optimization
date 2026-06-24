'use client'

import { ControlPanel } from '@/components/ControlPanel'
import { EntryCard } from '@/components/EntryCard'
import type { ContentEntry as ContentEntryType } from '@/lib/contentful'
import { CLICK_SCENARIOS, PAGES } from 'e2e-web'
import { useMemo, type JSX } from 'react'

function toEntryMap(entries: ContentEntryType[]): Map<string, ContentEntryType> {
  return new Map(entries.map((entry) => [entry.sys.id, entry]))
}

export function HomePage({
  baselineEntries,
}: {
  readonly baselineEntries: ContentEntryType[]
}): JSX.Element {
  const entriesById = useMemo(() => toEntryMap(baselineEntries), [baselineEntries])
  const liveUpdatesBaselineEntry = entriesById.get(PAGES.home.liveUpdates)

  return (
    <>
      <div className="page-header">
        <h1>Next.js SDK Hybrid</h1>
        <p className="page-header__subtitle">
          Reference implementation of @contentful/optimization-nextjs (SSR first paint + CSR
          takeover)
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
        {liveUpdatesBaselineEntry ? (
          <div className="sections-grid" data-testid="live-updates-examples">
            <section data-testid="live-updates-default">
              <h3>Default (inherits global setting)</h3>
              <EntryCard entry={liveUpdatesBaselineEntry} testId="live-default" />
            </section>

            <section data-testid="live-updates-enabled">
              <h3>Always On (liveUpdates=true)</h3>
              <EntryCard
                entry={liveUpdatesBaselineEntry}
                liveUpdates={true}
                testId="live-enabled"
              />
            </section>

            <section data-testid="live-updates-locked">
              <h3>Locked (liveUpdates=false)</h3>
              <EntryCard
                entry={liveUpdatesBaselineEntry}
                liveUpdates={false}
                testId="live-locked"
              />
            </section>
          </div>
        ) : (
          <p data-testid="live-updates-loading">Loading live updates entries...</p>
        )}
      </section>

      <div className="sections-grid sections-grid--split">
        <section className="page-section">
          <header className="page-section__header">
            <h2>Auto Observed Entries</h2>
          </header>
          <div id="auto-observed" className="entry-grid">
            {PAGES.home.auto.map((entryId) => {
              const entry = entriesById.get(entryId)
              if (!entry) return null

              if (entry.sys.contentType.sys.id === 'nestedContent') {
                return (
                  <section key={entry.sys.id} data-testid={`nested-content-entry-${entry.sys.id}`}>
                    <EntryCard entry={entry} />
                  </section>
                )
              }

              return (
                <EntryCard
                  key={entry.sys.id}
                  clickScenario={CLICK_SCENARIOS[entry.sys.id]}
                  entry={entry}
                  viewTracking="auto"
                />
              )
            })}
          </div>
        </section>

        <section className="page-section">
          <header className="page-section__header">
            <h2>Manually Observed Entries</h2>
          </header>
          <div id="manually-observed" className="entry-grid">
            {PAGES.home.manual.map((entryId) => {
              const entry = entriesById.get(entryId)
              if (!entry) return null
              return <EntryCard key={entry.sys.id} entry={entry} viewTracking="manual" />
            })}
          </div>
        </section>
      </div>
    </>
  )
}
