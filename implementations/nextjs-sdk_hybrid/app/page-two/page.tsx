import { ControlPanel } from '@/components/ControlPanel'
import { EntryCard } from '@/components/EntryCard'
import { TrackView } from '@/components/TrackView'
import { TrackViewButton } from '@/components/TrackViewButton'
import { loadPageEntries } from '@/lib/contentful'
import { toIdMap } from '@/lib/util'
import { PAGES } from 'e2e-web'
import Link from 'next/link'

export default async function PageTwo() {
  const entriesById = toIdMap(await loadPageEntries(PAGES.pageTwo.ids))
  const autoEntry = entriesById.get(PAGES.pageTwo.auto)
  const manualEntry = entriesById.get(PAGES.pageTwo.manual)

  return (
    <section data-testid="page-two-view">
      <h2>Page Two</h2>

      <TrackView componentId="page-two-hero" />
      <ControlPanel />

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
          <TrackViewButton componentId="page-two-demo-cta" testId="track-conversion-button">
            Trigger custom view event
          </TrackViewButton>
        </div>
      </section>

      <Link data-testid="link-back-home" href={PAGES.home.path}>
        Back to Home
      </Link>
    </section>
  )
}
