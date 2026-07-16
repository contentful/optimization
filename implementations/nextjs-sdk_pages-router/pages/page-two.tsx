import { ControlPanel } from '@/components/ControlPanel'
import { CustomViewTracker } from '@/components/CustomViewTracker'
import { EntryCard } from '@/components/EntryCard'
import { loadPageEntries, type ContentEntry } from '@/lib/contentful'
import {
  getPagesRouterOptimizationProps,
  type PagesRouterOptimizationProps,
} from '@/lib/optimization-server'
import { toIdMap } from '@/lib/util'
import { PAGES } from 'e2e-web'
import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import type { JSX } from 'react'

type PageTwoProps = PagesRouterOptimizationProps & {
  readonly entries: ContentEntry[]
}

export const getServerSideProps: GetServerSideProps<PageTwoProps> = async (context) => {
  const [entries, optimization] = await Promise.all([
    loadPageEntries(PAGES.pageTwo.ids),
    getPagesRouterOptimizationProps(context),
  ])

  return {
    props: {
      contentfulOptimization: optimization,
      entries,
    },
  }
}

export default function PageTwo({ contentfulOptimization, entries }: PageTwoProps): JSX.Element {
  const entriesById = toIdMap(entries)
  const autoEntry = entriesById.get(PAGES.pageTwo.auto)
  const manualEntry = entriesById.get(PAGES.pageTwo.manual)

  return (
    <section data-testid="page-two-view">
      <div className="page-header">
        <Link data-testid="link-back-home" href={PAGES.home.path}>
          Back to Home
        </Link>
        <h1>Page Two</h1>
      </div>

      <CustomViewTracker componentId="page-two-hero" />
      <ControlPanel demoCTA initialConsent={contentfulOptimization.consent} />

      <div className="sections-grid sections-grid--split" data-testid="page-two-optimization">
        <section className="page-section">
          <header className="page-section__header">
            <h2>Auto-observed</h2>
          </header>
          <div className="entry-grid">
            {autoEntry ? (
              <EntryCard baselineEntry={autoEntry} manualTracking={false} />
            ) : (
              <p>Auto tracked entry is unavailable.</p>
            )}
          </div>
        </section>

        <section className="page-section">
          <header className="page-section__header">
            <h2>Manually-observed</h2>
          </header>
          <div className="entry-grid">
            {manualEntry ? (
              <EntryCard baselineEntry={manualEntry} manualTracking={true} />
            ) : (
              <p>Manual tracked entry is unavailable.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
