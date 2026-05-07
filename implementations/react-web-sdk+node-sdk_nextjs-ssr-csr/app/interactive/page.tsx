'use client'

import { InteractiveControls } from '@/components/InteractiveControls'
import { ENTRY_IDS } from '@/config/entries'
import { fetchEntries } from '@/lib/contentful-client'
import type { ContentEntry } from '@/types/contentful'
import { useOptimization, useOptimizationContext } from '@contentful/optimization-react-web'
import Link from 'next/link'
import { type JSX, useEffect, useState } from 'react'

function getEntryText(entry: ContentEntry): string {
  return typeof entry.fields.text === 'string' ? entry.fields.text : 'No content'
}

function ClientResolvedEntry({ entry }: { entry: ContentEntry }): JSX.Element {
  const { resolveEntry } = useOptimization()
  const resolvedEntry = resolveEntry(entry)

  return (
    <div
      data-testid={`content-${entry.sys.id}`}
      data-ctfl-entry-id={resolvedEntry.sys.id}
      data-ctfl-baseline-id={entry.sys.id}
      className="rounded-lg border border-zinc-200 p-4"
    >
      <p data-testid={`entry-text-${entry.sys.id}`}>{getEntryText(resolvedEntry)}</p>
      <p className="text-xs text-zinc-400 mt-2">
        {`[Entry: ${entry.sys.id} — Client-Resolved]`}
      </p>
    </div>
  )
}

export default function InteractivePage(): JSX.Element {
  const { sdk, isReady } = useOptimizationContext()
  const [entries, setEntries] = useState<ContentEntry[]>([])

  useEffect(() => {
    if (!sdk || !isReady) {
      return
    }

    void fetchEntries(ENTRY_IDS).then((fetched) => {
      setEntries(fetched)
    })
  }, [isReady, sdk])

  return (
    <main className="flex-1 p-8 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-2">Interactive Page (CSR Takeover)</h1>
      <p className="text-zinc-500 mb-6">
        This page resolves entries client-side via the React Web SDK. Identify or consent changes
        re-resolve entries immediately without a server roundtrip. This demonstrates the CSR
        takeover after the SSR first paint on the home page.
      </p>

      <nav className="mb-6 flex gap-3">
        <Link
          href="/"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          ← Home (SSR)
        </Link>
        <span className="rounded border border-zinc-300 px-3 py-1.5 text-sm bg-zinc-100">
          Interactive (CSR)
        </span>
      </nav>

      <InteractiveControls />

      <section className="mt-6">
        <h2 className="text-lg font-medium mb-3">Entries (Client-Resolved, Live Updates)</h2>
        {!sdk || !isReady ? (
          <p data-testid="sdk-loading">Loading SDK...</p>
        ) : entries.length === 0 ? (
          <p data-testid="entries-loading">Loading entries...</p>
        ) : (
          <div className="grid gap-3">
            {entries.map((entry) => (
              <ClientResolvedEntry key={entry.sys.id} entry={entry} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
