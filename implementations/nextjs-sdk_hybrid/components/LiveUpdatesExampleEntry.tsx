import type { ContentEntry } from '@/lib/contentful'
import { OptimizedEntry } from '@contentful/optimization-nextjs/client'
import type { JSX } from 'react'

interface LiveUpdatesExampleEntryProps {
  baselineEntry: ContentEntry
  liveUpdates?: boolean
  testIdPrefix: string
}

export function LiveUpdatesExampleEntry({
  baselineEntry,
  liveUpdates,
  testIdPrefix,
}: LiveUpdatesExampleEntryProps): JSX.Element {
  return (
    <OptimizedEntry baselineEntry={baselineEntry} liveUpdates={liveUpdates}>
      {(resolvedEntry) => {
        const asCf = resolvedEntry as ContentEntry
        const text = typeof asCf.fields.text === 'string' ? asCf.fields.text : 'No content'
        const fullLabel = `${text} [Entry: ${resolvedEntry.sys.id}]`

        return (
          <div data-test-entry-id={resolvedEntry.sys.id} data-testid={`content-${testIdPrefix}`}>
            <p data-testid={`entry-text-${testIdPrefix}`} aria-label={fullLabel}>
              {text}
            </p>
            <p data-testid={`entry-id-${testIdPrefix}`}>Entry: {resolvedEntry.sys.id}</p>
          </div>
        )
      }}
    </OptimizedEntry>
  )
}
