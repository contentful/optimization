import type { ContentEntry, ContentEntrySkeleton } from '@/lib/contentful'
import { RequestOptimizedEntry } from '@/lib/optimization'
import type { EntryClickScenario } from 'e2e-web'
import type { JSX } from 'react'
import { createRichTextRenderOptions, EntryCardContent } from './EntryCardContent'

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
      <RequestOptimizedEntry
        as="div"
        baselineEntry={baselineEntry}
        clickable={autoTrackViews && clickScenario === 'direct'}
        trackViews={autoTrackViews ? undefined : false}
      >
        {(resolvedEntry, { getMergeTagValue }) => {
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
      </RequestOptimizedEntry>
    </section>
  )
}

export function ManagedEntryCard({ entryId }: Readonly<{ entryId: string }>): JSX.Element {
  return (
    <section className="entry-card" data-testid={`content-entry-${entryId}`}>
      <RequestOptimizedEntry<ContentEntrySkeleton> entryId={entryId}>
        {(resolvedEntry) => (
          <EntryCardContent entry={resolvedEntry} labelEntryId={entryId} testId={entryId} />
        )}
      </RequestOptimizedEntry>
    </section>
  )
}
