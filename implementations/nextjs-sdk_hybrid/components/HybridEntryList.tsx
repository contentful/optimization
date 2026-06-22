'use client'

import type { ContentEntry } from '@/types/contentful'
import { OptimizedEntry } from '@contentful/optimization-nextjs/client'
import type { JSX } from 'react'

function getEntryText(entry: ContentEntry): string {
  return typeof entry.fields.text === 'string' ? entry.fields.text : 'No content'
}

function HybridEntry({
  baselineEntry,
  serverResolvedEntry,
}: {
  baselineEntry: ContentEntry
  serverResolvedEntry: ContentEntry
}): JSX.Element {
  const renderEntry = (resolvedEntry: ContentEntry): JSX.Element => (
    <div className="rounded-lg border border-zinc-200 p-4">
      <p data-testid={`entry-text-${baselineEntry.sys.id}`}>{getEntryText(resolvedEntry)}</p>
    </div>
  )

  return (
    <OptimizedEntry
      baselineEntry={baselineEntry}
      liveUpdates={true}
      data-testid={`content-${baselineEntry.sys.id}`}
      loadingFallback={renderEntry(serverResolvedEntry)}
    >
      {(resolvedEntry) => renderEntry(resolvedEntry as ContentEntry)}
    </OptimizedEntry>
  )
}

interface HybridEntryListProps {
  baselineEntries: ContentEntry[]
  serverResolvedEntries: ContentEntry[]
}

export function HybridEntryList({
  baselineEntries,
  serverResolvedEntries,
}: HybridEntryListProps): JSX.Element {
  if (baselineEntries.length === 0) {
    return <p data-testid="entries-empty">No entries found.</p>
  }

  return (
    <div className="grid gap-3">
      {baselineEntries.map((entry, index) => (
        <HybridEntry
          key={entry.sys.id}
          baselineEntry={entry}
          serverResolvedEntry={serverResolvedEntries[index] ?? entry}
        />
      ))}
    </div>
  )
}
