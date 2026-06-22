'use client'

import { PAGE_TWO_AUTO_ENTRY_ID, PAGE_TWO_MANUAL_ENTRY_ID } from '@/config/entries'
import { ContentEntry } from '@/sections/ContentEntry'
import type { ContentEntry as ContentEntryType } from '@/types/contentful'
import {
  useConsentState,
  useOptimization,
  useProfileState,
} from '@contentful/optimization-nextjs/client'
import Link from 'next/link'
import { useEffect, useMemo, type JSX } from 'react'

function isIdentifiedProfile(profile: ReturnType<typeof useProfileState>): boolean {
  return profile !== undefined && Boolean(profile.traits.identified)
}

function toEntryMap(entries: ContentEntryType[]): Map<string, ContentEntryType> {
  return new Map(entries.map((entry) => [entry.sys.id, entry]))
}

export function PageTwoPage({
  baselineEntries,
}: {
  readonly baselineEntries: ContentEntryType[]
}): JSX.Element {
  const consent = useConsentState()
  const profile = useProfileState()
  const sdk = useOptimization()
  const entriesById = useMemo(() => toEntryMap(baselineEntries), [baselineEntries])
  const isIdentified = isIdentifiedProfile(profile)
  const pageTwoAutoEntry = entriesById.get(PAGE_TWO_AUTO_ENTRY_ID)
  const pageTwoManualEntry = entriesById.get(PAGE_TWO_MANUAL_ENTRY_ID)

  useEffect(() => {
    void sdk.trackView({
      componentId: 'page-two-hero',
      viewId: crypto.randomUUID(),
      viewDurationMs: 0,
    })
  }, [sdk])

  const handleDemoCta = (): void => {
    void sdk.trackView({
      componentId: 'page-two-demo-cta',
      viewId: crypto.randomUUID(),
      viewDurationMs: 0,
    })
  }

  return (
    <section data-testid="page-two-view" className="grid gap-4">
      <h2 className="text-lg font-medium">Page Two</h2>

      <section data-testid="page-two-status" className="grid gap-1">
        <p>{`Identified: ${isIdentified ? 'Yes' : 'No'}`}</p>
        <p>{`Consent: ${String(consent)}`}</p>
      </section>

      <section data-testid="page-two-optimization" className="grid gap-3">
        <h3>Page Two Optimized Content</h3>
        {pageTwoAutoEntry ? (
          <div>
            <p>Auto tracked example</p>
            <ContentEntry entry={pageTwoAutoEntry} viewTracking="auto" />
          </div>
        ) : (
          <p>Auto tracked entry is unavailable.</p>
        )}

        {pageTwoManualEntry ? (
          <div>
            <p>Manual tracked example</p>
            <ContentEntry entry={pageTwoManualEntry} viewTracking="manual" />
          </div>
        ) : (
          <p>Manual tracked entry is unavailable.</p>
        )}
      </section>

      <section data-testid="page-two-conversion" className="grid gap-2">
        <h3>Conversion Step Demo</h3>
        <button data-testid="page-two-demo-cta" onClick={handleDemoCta} type="button">
          Trigger Page Two CTA Event
        </button>
      </section>

      <Link data-testid="link-back-home" href="/">
        Back to Home
      </Link>
    </section>
  )
}
