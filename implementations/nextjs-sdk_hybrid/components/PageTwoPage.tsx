'use client'

import { EntryCard } from '@/components/EntryCard'
import type { ContentEntry as ContentEntryType } from '@/lib/contentful'
import {
  useConsentState,
  useOptimization,
  useProfileState,
} from '@contentful/optimization-nextjs/client'
import { PAGES } from 'e2e-web'
import Link from 'next/link'
import { useEffect, type JSX } from 'react'

function isIdentifiedProfile(profile: ReturnType<typeof useProfileState>): boolean {
  return profile !== undefined && Boolean(profile.traits.identified)
}

export interface PageTwoPageProps {
  readonly autoEntry?: ContentEntryType
  readonly manualEntry?: ContentEntryType
}

export function PageTwoPage({ autoEntry, manualEntry }: PageTwoPageProps): JSX.Element {
  const consent = useConsentState()
  const profile = useProfileState()
  const sdk = useOptimization()
  const isIdentified = isIdentifiedProfile(profile)

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
        {autoEntry ? (
          <div>
            <p>Auto tracked example</p>
            <EntryCard entry={autoEntry} viewTracking="auto" />
          </div>
        ) : (
          <p>Auto tracked entry is unavailable.</p>
        )}

        {manualEntry ? (
          <div>
            <p>Manual tracked example</p>
            <EntryCard entry={manualEntry} viewTracking="manual" />
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
