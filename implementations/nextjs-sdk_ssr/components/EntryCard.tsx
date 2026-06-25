import type { ContentEntry } from '@/lib/contentful'
import {
  ServerOptimizedEntry,
  type ServerTrackingResolvedData,
} from '@contentful/optimization-nextjs/server'
import type { EntryClickScenario } from 'e2e-web'
import type { JSX } from 'react'

const HOVER_DURATION_UPDATE_INTERVAL_MS = 1000

interface EntryCardProps {
  baselineEntry: ContentEntry
  clickScenario?: EntryClickScenario
  resolvedData: ServerTrackingResolvedData
  viewTracking: 'auto' | 'manual'
}

export function EntryCard({
  baselineEntry,
  clickScenario,
  resolvedData,
  viewTracking,
}: EntryCardProps): JSX.Element {
  const resolvedEntry = resolvedData.entry as ContentEntry
  const autoTrackViews = viewTracking === 'auto'
  const text = typeof resolvedEntry.fields.text === 'string' ? resolvedEntry.fields.text : ''

  const content = (
    <div data-ctfl-entry-id={resolvedEntry.sys.id} data-testid={`content-${baselineEntry.sys.id}`}>
      <div
        aria-label={`Entry: ${baselineEntry.sys.id}`}
        data-testid={`entry-text-${baselineEntry.sys.id}`}
      >
        <p>{text}</p>
        <p>{`[Entry: ${baselineEntry.sys.id}]`}</p>
      </div>
      {clickScenario === 'descendant' ? (
        <button data-testid="entry-click-descendant-button" type="button">
          Trigger entry click tracking from descendant button
        </button>
      ) : null}
    </div>
  )

  return (
    <section className="entry-card" data-testid={`content-entry-${baselineEntry.sys.id}`}>
      <ServerOptimizedEntry
        as="div"
        baselineEntry={baselineEntry}
        clickable={autoTrackViews && clickScenario === 'direct'}
        hoverDurationUpdateIntervalMs={
          autoTrackViews ? HOVER_DURATION_UPDATE_INTERVAL_MS : undefined
        }
        resolvedData={resolvedData}
        trackViews={autoTrackViews ? undefined : false}
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
