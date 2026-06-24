'use client'

import { ContentEntry } from '@/components/ContentEntry'
import type { ContentEntry as ContentEntryType } from '@/lib/contentful'
import {
  useConsentState,
  useOptimization,
  useProfileState,
} from '@contentful/optimization-nextjs/client'
import { PAGES } from 'e2e-web'
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
  const pageTwoAutoEntry = entriesById.get(PAGES.pageTwo.auto)
  const pageTwoManualEntry = entriesById.get(PAGES.pageTwo.manual)

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
    <section data-testid="page-two-view">
      <h2>Page Two</h2>

      <section data-testid="page-two-status">
        <p>{`Identified: ${isIdentified ? 'Yes' : 'No'}`}</p>
        <p>{`Consent: ${String(consent)}`}</p>
      </section>

      <section className="page-section" data-testid="page-two-optimization">
        <header className="page-section__header">
          <h3>Page Two Optimized Content</h3>
        </header>
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

      <section className="page-section" data-testid="page-two-conversion">
        <header className="page-section__header">
          <h3>Conversion Step Demo</h3>
        </header>
        <div className="control-panel__actions">
          <button
            className="btn btn--secondary btn--sm"
            data-testid="track-conversion-button"
            onClick={handleDemoCta}
            type="button"
          >
            Trigger custom view event
          </button>
        </div>
      </section>

      <Link data-testid="link-back-home" href={PAGES.home.path}>
        Back to Home
      </Link>
    </section>
  )
}
