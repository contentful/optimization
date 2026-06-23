import { InteractiveControls } from '@/components/InteractiveControls'
import { AUTO_OBSERVED_ENTRY_IDS, ENTRY_IDS, MANUALLY_OBSERVED_ENTRY_IDS } from '@/config/entries'
import { APP_LOCALE } from '@/lib/config'
import { fetchEntries } from '@/lib/contentful-client'
import { optimization } from '@/lib/optimization-server'
import type { ContentEntry } from '@/types/contentful'
import {
  ServerOptimizedEntry,
  getNextjsServerOptimizationData,
  type ServerTrackingResolvedData,
} from '@contentful/optimization-nextjs/server'
import { cookies, headers } from 'next/headers'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'
const HOVER_DURATION_UPDATE_INTERVAL_MS = 1000
type EntryClickScenario = 'direct' | 'descendant' | 'ancestor'

const AUTO_OBSERVED_CLICK_SCENARIO_BY_ENTRY_ID: Readonly<Record<string, EntryClickScenario>> = {
  '4ib0hsHWoSOnCVdDkizE8d': 'direct',
  xFwgG3oNaOcjzWiGe4vXo: 'descendant',
  '2Z2WLOx07InSewC3LUB3eX': 'ancestor',
}

function getEntryText(entry: ContentEntry): string {
  return typeof entry.fields.text === 'string' ? entry.fields.text : 'No content'
}

function ServerRenderedEntry({
  baselineEntry,
  clickScenario,
  resolvedData,
  viewTracking,
}: {
  baselineEntry: ContentEntry
  clickScenario?: EntryClickScenario
  resolvedData: ServerTrackingResolvedData
  viewTracking: 'auto' | 'manual'
}) {
  const resolvedEntry = resolvedData.entry as ContentEntry
  const autoTrackViews = viewTracking === 'auto'
  const content = (
    <div data-testid={`content-${baselineEntry.sys.id}`}>
      <p data-testid={`entry-text-${baselineEntry.sys.id}`}>{getEntryText(resolvedEntry)}</p>
      <p className="text-xs text-zinc-400 mt-2">{`[Entry: ${baselineEntry.sys.id}]`}</p>

      {clickScenario === 'descendant' ? (
        <button data-testid="entry-click-descendant-button" type="button">
          Trigger entry click tracking from descendant button
        </button>
      ) : null}
    </div>
  )

  return (
    <section data-testid={`content-entry-${baselineEntry.sys.id}`}>
      <ServerOptimizedEntry
        as="div"
        baselineEntry={baselineEntry}
        clickable={autoTrackViews && clickScenario === 'direct'}
        hoverDurationUpdateIntervalMs={
          autoTrackViews ? HOVER_DURATION_UPDATE_INTERVAL_MS : undefined
        }
        resolvedData={resolvedData}
        trackViews={autoTrackViews ? undefined : false}
        className="rounded-lg border border-zinc-200 p-4"
      >
        {autoTrackViews && clickScenario === 'ancestor' ? (
          <div data-ctfl-clickable="true" data-testid="entry-click-ancestor-wrapper">
            {content}
          </div>
        ) : (
          content
        )}
      </ServerOptimizedEntry>
    </section>
  )
}

export default async function Home() {
  const cookieStore = await cookies()
  const headerStore = await headers()

  const appConsent = cookieStore.get(APP_PERSONALIZATION_CONSENT_COOKIE)?.value === 'granted'
  const [baselineEntries, optimizationData] = await Promise.all([
    fetchEntries(ENTRY_IDS, APP_LOCALE),
    appConsent
      ? getNextjsServerOptimizationData(optimization, {
          consent: { events: true, persistence: true },
          cookies: cookieStore,
          headers: headerStore,
          locale: APP_LOCALE,
        }).then(({ data }) => data)
      : undefined,
  ])

  const resolvedEntryById = new Map(
    baselineEntries.map((entry) => [
      entry.sys.id,
      optimization.resolveOptimizedEntry(entry, optimizationData?.selectedOptimizations),
    ]),
  )

  return (
    <>
      <InteractiveControls />

      <section>
        <h2 className="text-lg font-medium mb-3">Auto Observed Entries</h2>
        <div id="auto-observed" className="grid gap-3">
          {AUTO_OBSERVED_ENTRY_IDS.map((entryId) => {
            const entry = baselineEntries.find((candidate) => candidate.sys.id === entryId)
            const resolvedData = resolvedEntryById.get(entryId)

            return entry && resolvedData ? (
              <ServerRenderedEntry
                key={entry.sys.id}
                baselineEntry={entry}
                clickScenario={AUTO_OBSERVED_CLICK_SCENARIO_BY_ENTRY_ID[entry.sys.id]}
                resolvedData={resolvedData}
                viewTracking="auto"
              />
            ) : null
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Manually Observed Entries</h2>
        <div id="manually-observed" className="grid gap-3">
          {MANUALLY_OBSERVED_ENTRY_IDS.map((entryId) => {
            const entry = baselineEntries.find((candidate) => candidate.sys.id === entryId)
            const resolvedData = resolvedEntryById.get(entryId)

            return entry && resolvedData ? (
              <ServerRenderedEntry
                key={entry.sys.id}
                baselineEntry={entry}
                resolvedData={resolvedData}
                viewTracking="manual"
              />
            ) : null
          })}
        </div>
      </section>
    </>
  )
}
