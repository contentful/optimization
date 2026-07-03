'use client'

import type { ContentEntry } from '@/lib/contentful'
import { OptimizedEntry } from '@/lib/optimization'
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
        const asCf = resolvedEntry as ContentEntry
        const text = typeof asCf.fields.text === 'string' ? asCf.fields.text : ''
        const fullLabel = `${text} [Entry: ${resolvedEntry.sys.id}]`

        return (
          <EntryCardContent
            className="entry-card"
            entry={asCf}
            renderOptions={createRichTextRenderOptions(getMergeTagValue)}
            testId={testId}
            textAriaLabel={fullLabel}
          />
        )
      }}
    </OptimizedEntry>
  )
}
