'use client'

import type { ContentEntry } from '@/lib/contentful'
import { OptimizedEntry } from '@contentful/optimization-nextjs/client'
import type { JSX } from 'react'
import { createRichTextRenderOptions, EntryCardContent } from './EntryCardContent'

interface LiveEntryCardProps {
  entry: ContentEntry
  liveUpdates?: boolean
  testId: string
}

export function LiveEntryCard({ entry, liveUpdates, testId }: LiveEntryCardProps): JSX.Element {
  return (
    <OptimizedEntry baselineEntry={entry} liveUpdates={liveUpdates}>
      {(resolvedEntry, { getMergeTagValue }) => {
        const text = typeof resolvedEntry.fields.text === 'string' ? resolvedEntry.fields.text : ''
        const fullLabel = `${text} [Entry: ${resolvedEntry.sys.id}]`

        return (
          <EntryCardContent
            className="entry-card"
            entry={resolvedEntry}
            renderOptions={createRichTextRenderOptions(getMergeTagValue)}
            testId={testId}
            textAriaLabel={fullLabel}
          />
        )
      }}
    </OptimizedEntry>
  )
}
