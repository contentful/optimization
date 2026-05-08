'use client'

import type { ContentEntry } from '@/types/contentful'
import { useOptimization, useOptimizationContext } from '@contentful/optimization-react-web'
import type { SelectedOptimizationArray } from '@contentful/optimization-react-web/api-schemas'
import { type JSX, useEffect, useState } from 'react'

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
  const { sdk, isReady } = useOptimizationContext()
  const { resolveEntry } = useOptimization()
  const [selectedOptimizations, setSelectedOptimizations] = useState<
    SelectedOptimizationArray | undefined
  >(undefined)

  useEffect(() => {
    if (!sdk || !isReady) {
      return
    }

    const subscription = sdk.states.selectedOptimizations.subscribe((value) => {
      setSelectedOptimizations(value)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [sdk, isReady])

  const clientReady = isReady && selectedOptimizations !== undefined
  const resolvedEntry = clientReady
    ? resolveEntry(baselineEntry, selectedOptimizations)
    : serverResolvedEntry

  return (
    <div
      data-testid={`content-${baselineEntry.sys.id}`}
      data-ctfl-entry-id={resolvedEntry.sys.id}
      data-ctfl-baseline-id={baselineEntry.sys.id}
      className="rounded-lg border border-zinc-200 p-4"
    >
      <p data-testid={`entry-text-${baselineEntry.sys.id}`}>{getEntryText(resolvedEntry)}</p>
    </div>
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
