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
      {({ fields, sys: { id } }) => (
        <div data-test-entry-id={id} data-testid={`content-${testId}`}>
          <div
            aria-label={`${fields.text ?? ''} [Entry: ${id}]`}
            data-testid={`entry-text-${testId}`}
          >
            <p>{String(fields.text ?? '')}</p>
            <p>{`[Entry: ${id}]`}</p>
          </div>
        </div>
      )}
    </OptimizedEntry>
  )
}
