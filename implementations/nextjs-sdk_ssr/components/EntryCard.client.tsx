'use client'

import type { ContentEntry } from '@/lib/contentful'
import { OptimizedEntry } from '@contentful/optimization-nextjs/client'
import type { JSX } from 'react'

interface EntryCardClientProps {
  entry: ContentEntry
  liveUpdates?: boolean
  testId: string
}

export function EntryCardClient({ entry, liveUpdates, testId }: EntryCardClientProps): JSX.Element {
  return (
    <OptimizedEntry baselineEntry={entry} liveUpdates={liveUpdates}>
      {(resolvedEntry) => {
        const asCf = resolvedEntry as ContentEntry
        const text = typeof asCf.fields.text === 'string' ? asCf.fields.text : ''

        return (
          <div
            className="entry-card"
            data-test-entry-id={resolvedEntry.sys.id}
            data-testid={`content-${testId}`}
          >
            <div
              aria-label={`${text} [Entry: ${resolvedEntry.sys.id}]`}
              data-testid={`entry-text-${testId}`}
            >
              <p>{text}</p>
              <p>{`[Entry: ${resolvedEntry.sys.id}]`}</p>
            </div>
          </div>
        )
      }}
    </OptimizedEntry>
  )
}
