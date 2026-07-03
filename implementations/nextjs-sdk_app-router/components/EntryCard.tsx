import type { ContentEntry } from '@/lib/contentful'
import { OptimizedEntry } from '@/lib/optimization'
import type { EntryClickScenario } from 'e2e-web'
import type { JSX } from 'react'
import { createRichTextRenderOptions, EntryCardContent } from './EntryCardContent'

const HOVER_DURATION_UPDATE_INTERVAL_MS = 1000

interface EntryCardProps {
  baselineEntry: ContentEntry
  clickScenario?: EntryClickScenario
  manualTracking: boolean
}

export function EntryCard({
  baselineEntry,
  clickScenario,
  manualTracking,
}: EntryCardProps): JSX.Element {
  const autoTrackViews = !manualTracking

  return (
    <section className="entry-card" data-testid={`content-entry-${baselineEntry.sys.id}`}>
      <OptimizedEntry
        as="div"
        baselineEntry={baselineEntry}
        clickable={autoTrackViews && clickScenario === 'direct'}
        hoverDurationUpdateIntervalMs={
          autoTrackViews ? HOVER_DURATION_UPDATE_INTERVAL_MS : undefined
        }
        trackViews={autoTrackViews ? undefined : false}
      >
        {(entry, { getMergeTagValue }) => {
          const resolvedEntry = entry as ContentEntry

          return (
            <EntryCardContent
              clickableAncestor={autoTrackViews && clickScenario === 'ancestor'}
              clickScenario={clickScenario}
              entry={resolvedEntry}
              labelEntryId={baselineEntry.sys.id}
              renderNestedEntry={(nestedEntry) => (
                <EntryCard
                  baselineEntry={nestedEntry}
                  key={nestedEntry.sys.id}
                  manualTracking={false}
                />
              )}
              renderOptions={createRichTextRenderOptions(getMergeTagValue)}
              testId={baselineEntry.sys.id}
            />
          )
        }}
      </OptimizedEntry>
    </section>
  )
}
