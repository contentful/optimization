import { OptimizedEntry } from '@contentful/optimization-react-web'
import type { JSX } from 'react'
import type { ContentfulEntry } from '../types/contentful'

interface LiveUpdatesExampleEntryProps {
  baselineEntry: ContentfulEntry
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
        const asCf = resolvedEntry as ContentfulEntry
        const text = typeof asCf.fields.text === 'string' ? asCf.fields.text : 'No content'
        const fullLabel = `${text} [Entry: ${resolvedEntry.sys.id}]`

        return (
          <div data-testid={`content-${testIdPrefix}`}>
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
