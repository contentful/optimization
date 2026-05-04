'use client'

import { ENTRY_IDS } from '@/config/entries'
import { fetchEntries } from '@/lib/contentful-client'
import type { ContentEntry } from '@/types/contentful'
import { useOptimization, useOptimizationContext } from '@contentful/optimization-react-web'
import type { Profile } from '@contentful/optimization-react-web/api-schemas'
import { type JSX, useEffect, useMemo, useState } from 'react'

function getEntryText(entry: ContentEntry): string {
  return typeof entry.fields.text === 'string' ? entry.fields.text : 'No content'
}

function ResolvedEntry({ entry }: { entry: ContentEntry }): JSX.Element {
  const { resolveEntry, resolveEntryData } = useOptimization()
  const resolvedEntry = resolveEntry(entry) as ContentEntry
  const { selectedOptimization } = resolveEntryData(entry)
  const experienceId =
    selectedOptimization &&
    typeof selectedOptimization === 'object' &&
    'experienceId' in selectedOptimization
      ? (selectedOptimization as { experienceId: string }).experienceId
      : undefined

  return (
    <div
      data-testid={`content-${entry.sys.id}`}
      data-ctfl-entry-id={resolvedEntry.sys.id}
      data-ctfl-baseline-id={entry.sys.id}
      data-ctfl-optimization-id={experienceId}
      className="rounded-lg border border-zinc-200 p-4"
    >
      <p data-testid={`entry-text-${entry.sys.id}`}>{getEntryText(resolvedEntry)}</p>
      <p className="text-xs text-zinc-400 mt-2">{`[Entry: ${entry.sys.id}]`}</p>
    </div>
  )
}

function EntryList(): JSX.Element {
  const { sdk, isReady } = useOptimizationContext()
  const [entries, setEntries] = useState<ContentEntry[]>([])
  const [consent, setConsent] = useState<boolean | undefined>(undefined)
  const [profile, setProfile] = useState<Profile | undefined>(undefined)
  const [selectedOptimizationCount, setSelectedOptimizationCount] = useState(0)

  useEffect(() => {
    if (!sdk || !isReady) {
      return
    }

    const consentSub = sdk.states.consent.subscribe((value: boolean | undefined) => {
      setConsent(value)
    })

    const profileSub = sdk.states.profile.subscribe((value: Profile | undefined) => {
      setProfile(value)
    })

    const selectedOptSub = sdk.states.selectedOptimizations.subscribe((value) => {
      setSelectedOptimizationCount(Array.isArray(value) ? value.length : 0)
    })

    return () => {
      consentSub.unsubscribe()
      profileSub.unsubscribe()
      selectedOptSub.unsubscribe()
    }
  }, [isReady, sdk])

  useEffect(() => {
    if (!sdk || !isReady) {
      return
    }

    void fetchEntries(ENTRY_IDS).then((nextEntries) => {
      setEntries(nextEntries)
    })
  }, [isReady, sdk])

  const isIdentified = useMemo(
    () => profile !== undefined && Boolean(profile.traits.identified),
    [profile],
  )

  if (!sdk || !isReady) {
    return <p data-testid="sdk-loading">Loading SDK...</p>
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-zinc-200 p-4">
        <h2 className="text-lg font-medium mb-3">Controls</h2>
        <div className="flex gap-3 flex-wrap">
          <button
            data-testid="consent-button"
            onClick={() => {
              sdk.consent(consent !== true)
            }}
            type="button"
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            {consent === true ? 'Reject Consent' : 'Accept Consent'}
          </button>

          {!isIdentified ? (
            <button
              data-testid="identify-button"
              onClick={() => {
                void sdk.identify({ userId: 'charles', traits: { identified: true } })
              }}
              type="button"
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
            >
              Identify
            </button>
          ) : (
            <button
              data-testid="reset-button"
              onClick={() => {
                sdk.reset()
              }}
              type="button"
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
            >
              Reset Profile
            </button>
          )}
        </div>

        <div className="mt-3 text-sm text-zinc-500 space-y-1">
          <p data-testid="consent-status">Consent: {String(consent)}</p>
          <p data-testid="selected-optimizations-count">
            Selected Optimizations: {selectedOptimizationCount}
          </p>
          <p data-testid="identified-status">Identified: {isIdentified ? 'Yes' : 'No'}</p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Entries (Client-Resolved)</h2>
        {entries.length === 0 ? (
          <p data-testid="entries-loading">Loading entries...</p>
        ) : (
          <div className="grid gap-3">
            {entries.map((entry) => (
              <ResolvedEntry key={entry.sys.id} entry={entry} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default function ClientResolvedPage(): JSX.Element {
  return (
    <main className="flex-1 p-8 max-w-3xl mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-2">Client-Resolved Pattern</h1>
      <p className="text-zinc-500 mb-6">
        Entries are fetched from Contentful and resolved entirely on the client via the React SDK.
        The server renders an HTML shell; the Web SDK resolves optimizations in the browser.
      </p>
      <EntryList />
    </main>
  )
}
