import type { JSX } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { AppOutletContext } from '../App'
import { ControlPanel } from '../components/ControlPanel'
import { AUTO_OBSERVED_ENTRY_IDS, MANUALLY_OBSERVED_ENTRY_IDS } from '../config/entries'
import { type EntryClickScenario, ContentEntry } from '../sections/ContentEntry'
import { LiveUpdatesExampleEntry } from '../sections/LiveUpdatesExampleEntry'
import { NestedContentEntry } from '../sections/NestedContentEntry'
import type { ContentEntry as ContentEntryType } from '../types/contentful'

const AUTO_OBSERVED_CLICK_SCENARIO_BY_ENTRY_ID: Readonly<Record<string, EntryClickScenario>> = {
  '4ib0hsHWoSOnCVdDkizE8d': 'direct',
  xFwgG3oNaOcjzWiGe4vXo: 'descendant',
  '2Z2WLOx07InSewC3LUB3eX': 'ancestor',
}

interface AutoObservedEntriesProps {
  entriesById: Map<string, ContentEntryType>
}

function AutoObservedEntries({ entriesById }: AutoObservedEntriesProps): JSX.Element {
  return (
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
            clickScenario={AUTO_OBSERVED_CLICK_SCENARIO_BY_ENTRY_ID[entry.sys.id]}
            entry={entry}
            viewTracking="auto"
          />
        )
      })}
    </div>
  )
}

interface ManuallyObservedEntriesProps {
  entriesById: Map<string, ContentEntryType>
}

function ManuallyObservedEntries({ entriesById }: ManuallyObservedEntriesProps): JSX.Element {
  return (
    <div className="entry-grid" id="manually-observed">
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

export function HomePage(): JSX.Element {
  const {
    entriesById,
    liveUpdatesBaselineEntry,
    selectedOptimizationCount,
    onToggleGlobalLiveUpdates,
  } = useOutletContext<AppOutletContext>()
  const isOptimizationReady = selectedOptimizationCount > 0 || entriesById.size > 0

  if (!isOptimizationReady) {
    return <p data-testid="home-loading">Loading optimization data...</p>
  }

  return (
    <>
      <div className="page-header">
        <h1>React Web SDK</h1>
        <p className="page-header__subtitle">
          Reference implementation of @contentful/optimization-react-web
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
