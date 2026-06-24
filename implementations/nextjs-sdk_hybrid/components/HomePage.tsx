'use client'

import { ContentEntry } from '@/components/ContentEntry'
import { InteractiveControls } from '@/components/InteractiveControls'
import { LiveUpdatesExampleEntry } from '@/components/LiveUpdatesExampleEntry'
import { NestedContentItem } from '@/components/NestedContentItem'
import type { ContentEntry as ContentEntryType } from '@/lib/contentful'
import { CLICK_SCENARIOS, PAGES } from 'e2e-web'
import { useMemo, type JSX } from 'react'

function toEntryMap(entries: ContentEntryType[]): Map<string, ContentEntryType> {
  return new Map(entries.map((entry) => [entry.sys.id, entry]))
}

function AutoObservedEntries({
  entriesById,
}: {
  readonly entriesById: Map<string, ContentEntryType>
}): JSX.Element {
  return (
    <div id="auto-observed" className="entry-grid">
      {PAGES.home.auto.map((entryId) => {
        const entry = entriesById.get(entryId)
        if (!entry) {
          return null
        }

        if (entry.sys.contentType.sys.id === 'nestedContent') {
          return (
            <section key={entry.sys.id} data-testid={`nested-content-entry-${entry.sys.id}`}>
              <NestedContentItem entry={entry} />
            </section>
          )
        }

        return (
          <ContentEntry
            key={entry.sys.id}
            clickScenario={CLICK_SCENARIOS[entry.sys.id]}
            entry={entry}
            viewTracking="auto"
          />
        )
      })}
    </div>
  )
}

function ManuallyObservedEntries({
  entriesById,
}: {
  readonly entriesById: Map<string, ContentEntryType>
}): JSX.Element {
  return (
    <div id="manually-observed" className="entry-grid">
      {PAGES.home.manual.map((entryId) => {
        const entry = entriesById.get(entryId)
        if (!entry) {
          return null
        }

        return <ContentEntry key={entry.sys.id} entry={entry} viewTracking="manual" />
      })}
    </div>
  )
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

      <InteractiveControls />

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
              <LiveUpdatesExampleEntry
                baselineEntry={liveUpdatesBaselineEntry}
                testIdPrefix="live-default"
              />
            </section>

            <section data-testid="live-updates-enabled">
              <h3>Always On (liveUpdates=true)</h3>
              <LiveUpdatesExampleEntry
                baselineEntry={liveUpdatesBaselineEntry}
                liveUpdates={true}
                testIdPrefix="live-enabled"
              />
            </section>

            <section data-testid="live-updates-locked">
              <h3>Locked (liveUpdates=false)</h3>
              <LiveUpdatesExampleEntry
                baselineEntry={liveUpdatesBaselineEntry}
                liveUpdates={false}
                testIdPrefix="live-locked"
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
          <AutoObservedEntries entriesById={entriesById} />
        </section>

        <section className="page-section">
          <header className="page-section__header">
            <h2>Manually Observed Entries</h2>
          </header>
          <ManuallyObservedEntries entriesById={entriesById} />
        </section>
      </div>
    </>
  )
}
