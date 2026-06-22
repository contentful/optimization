'use client'

import { InteractiveControls } from '@/components/InteractiveControls'
import {
  AUTO_OBSERVED_ENTRY_IDS,
  LIVE_UPDATES_ENTRY_ID,
  MANUALLY_OBSERVED_ENTRY_IDS,
} from '@/config/entries'
import { ContentEntry, type EntryClickScenario } from '@/sections/ContentEntry'
import { LiveUpdatesExampleEntry } from '@/sections/LiveUpdatesExampleEntry'
import { NestedContentEntry } from '@/sections/NestedContentEntry'
import type { ContentEntry as ContentEntryType } from '@/types/contentful'
import { useMemo, type JSX } from 'react'

const AUTO_OBSERVED_CLICK_SCENARIO_BY_ENTRY_ID: Readonly<Record<string, EntryClickScenario>> = {
  '4ib0hsHWoSOnCVdDkizE8d': 'direct',
  xFwgG3oNaOcjzWiGe4vXo: 'descendant',
  '2Z2WLOx07InSewC3LUB3eX': 'ancestor',
}

function toEntryMap(entries: ContentEntryType[]): Map<string, ContentEntryType> {
  return new Map(entries.map((entry) => [entry.sys.id, entry]))
}

function AutoObservedEntries({
  entriesById,
}: {
  readonly entriesById: Map<string, ContentEntryType>
}): JSX.Element {
  return (
    <div id="auto-observed" className="grid gap-4">
      {AUTO_OBSERVED_ENTRY_IDS.map((entryId) => {
        const entry = entriesById.get(entryId)
        if (!entry) {
          return null
        }

        if (entry.sys.contentType.sys.id === 'nestedContent') {
          return <NestedContentEntry key={entry.sys.id} entry={entry} />
        }

        return (
          <ContentEntry
            key={entry.sys.id}
            clickScenario={AUTO_OBSERVED_CLICK_SCENARIO_BY_ENTRY_ID[entry.sys.id]}
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
    <div id="manually-observed" className="grid gap-4">
      {MANUALLY_OBSERVED_ENTRY_IDS.map((entryId) => {
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
  const liveUpdatesBaselineEntry = entriesById.get(LIVE_UPDATES_ENTRY_ID)

  return (
    <>
      <InteractiveControls />

      <section>
        <h2 className="text-lg font-medium mb-3">Live Updates</h2>
        {liveUpdatesBaselineEntry ? (
          <div data-testid="live-updates-examples" className="grid gap-4">
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

      <section>
        <h2 className="text-lg font-medium mb-3">Auto Observed Entries</h2>
        <AutoObservedEntries entriesById={entriesById} />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Manually Observed Entries</h2>
        <ManuallyObservedEntries entriesById={entriesById} />
      </section>
    </>
  )
}
