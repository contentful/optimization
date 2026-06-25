'use client'

import type { ContentEntry } from '@/lib/contentful'
import { OptimizedEntry } from '@contentful/optimization-nextjs/client'
import type { JSX } from 'react'

interface LiveEntryCardProps {
  entry: ContentEntry
  liveUpdates?: boolean
  testId: string
}

export function LiveEntryCard({ entry, liveUpdates, testId }: LiveEntryCardProps): JSX.Element {
  return (
    <OptimizedEntry baselineEntry={entry} liveUpdates={liveUpdates}>
      {(resolvedEntry) => {
        const asCf = resolvedEntry as ContentEntry
        const text = typeof asCf.fields.text === 'string' ? asCf.fields.text : ''
        const fullLabel = `${text} [Entry: ${resolvedEntry.sys.id}]`

        return (
          <div
            className="entry-card"
            data-test-entry-id={resolvedEntry.sys.id}
            data-testid={`content-${testId}`}
          >
            <div aria-label={fullLabel} data-testid={`entry-text-${testId}`}>
              <p>{text}</p>
              <p>{`[Entry: ${resolvedEntry.sys.id}]`}</p>
            </div>
          </div>
        )
      }}
    </OptimizedEntry>
  )
}
