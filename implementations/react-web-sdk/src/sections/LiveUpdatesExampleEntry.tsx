import { OptimizedEntry, useLiveUpdates } from '@contentful/optimization-react-web'
import { type JSX } from 'react'
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
  const { previewPanelVisible, globalLiveUpdates } = useLiveUpdates()

  const shouldLiveUpdate = previewPanelVisible || (liveUpdates ?? globalLiveUpdates)

  return (
    <OptimizedEntry baselineEntry={baselineEntry} liveUpdates={shouldLiveUpdate}>
      {(resolvedEntry) => {
        const text =
          typeof (resolvedEntry as ContentfulEntry).fields.text === 'string'
            ? (resolvedEntry as ContentfulEntry).fields.text
            : 'No content'
        const fullLabel = `${String(text)} [Entry: ${resolvedEntry.sys.id}]`

        return (
          <div data-testid={`content-${testIdPrefix}`}>
            <p data-testid={`entry-text-${testIdPrefix}`} aria-label={fullLabel}>
              {String(text)}
            </p>
            <p data-testid={`entry-id-${testIdPrefix}`}>Entry: {resolvedEntry.sys.id}</p>
          </div>
        )
      }}
    </OptimizedEntry>
  )
}
