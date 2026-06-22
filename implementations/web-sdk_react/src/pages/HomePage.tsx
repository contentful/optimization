import { FIXTURES } from 'e2e-web/src/fixtures'
import type { JSX } from 'react'
import { ControlPanel } from '../components/ControlPanel'
import { AUTO_OBSERVED_ENTRY_IDS, MANUALLY_OBSERVED_ENTRY_IDS } from '../config/entries'
import { ContentEntry } from '../sections/ContentEntry'
import { LiveUpdatesExampleEntry } from '../sections/LiveUpdatesExampleEntry'
import { NestedContentEntry } from '../sections/NestedContentEntry'
import type { ContentfulEntry } from '../types/contentful'

const { clickScenarios } = FIXTURES

interface HomePageProps {
  entriesById: Map<string, ContentfulEntry>
  liveUpdatesBaselineEntry: ContentfulEntry
  onToggleGlobalLiveUpdates: () => void
}

export function HomePage({
  entriesById,
  liveUpdatesBaselineEntry,
  onToggleGlobalLiveUpdates,
}: HomePageProps): JSX.Element {
  return (
    <>
      <div className="page-header">
        <h1>Web SDK + React</h1>
        <p className="page-header__subtitle">
          Reference implementation of @contentful/optimization-web
        </p>
      </div>

      <ControlPanel onToggleGlobalLiveUpdates={onToggleGlobalLiveUpdates} />

      <section className="page-section" data-testid="live-updates-section">
        <header className="page-section__header">
          <h2>Live Updates</h2>
          <p>
            Toggle global live updates and identify the user to verify how entries update. Optional
            per-component control is available through the <code>liveUpdates</code> prop.
          </p>
        </header>
        <div className="sections-grid" data-testid="live-updates-examples">
          <LiveUpdatesExampleEntry
            baselineEntry={liveUpdatesBaselineEntry}
            testIdPrefix="live-default"
          />
          <LiveUpdatesExampleEntry
            baselineEntry={liveUpdatesBaselineEntry}
            liveUpdates={true}
            testIdPrefix="live-enabled"
          />
          <LiveUpdatesExampleEntry
            baselineEntry={liveUpdatesBaselineEntry}
            liveUpdates={false}
            testIdPrefix="live-locked"
          />
        </div>
      </section>

      <div className="sections-grid sections-grid--split">
        <section className="page-section">
          <header className="page-section__header">
            <h2>Auto Observed Entries</h2>
          </header>
          <div className="entry-grid" id="auto-observed">
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
                  clickScenario={clickScenarios[entry.sys.id]}
                  entry={entry}
                  observation="auto"
                />
              )
            })}
          </div>
        </section>

        <section className="page-section">
          <header className="page-section__header">
            <h2>Manually Observed Entries</h2>
          </header>
          <div className="entry-grid" id="manually-observed">
            {MANUALLY_OBSERVED_ENTRY_IDS.map((entryId) => {
              const entry = entriesById.get(entryId)
              if (!entry) {
                return null
              }

              return <ContentEntry key={entry.sys.id} entry={entry} observation="manual" />
            })}
          </div>
        </section>
      </div>
    </>
  )
}
