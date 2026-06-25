import { ControlPanel } from '@/components/ControlPanel'
import { CustomViewTracker } from '@/components/CustomViewTracker'
import { EntryCard } from '@/components/EntryCard'
import { APP_LOCALE, APP_PERSONALIZATION_CONSENT_COOKIE } from '@/lib/config'
import { loadPageEntries } from '@/lib/contentful'
import { optimization } from '@/lib/optimization'
import { toIdMap } from '@/lib/util'
import { getNextjsServerOptimizationData } from '@contentful/optimization-nextjs/server'
import { PAGES } from 'e2e-web'
import { cookies, headers } from 'next/headers'
import Link from 'next/link'

export default async function PageTwo() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const appConsent = cookieStore.get(APP_PERSONALIZATION_CONSENT_COOKIE)?.value === 'granted'

  const [entries, optimizationData] = await Promise.all([
    loadPageEntries(PAGES.pageTwo.ids),
    appConsent
      ? getNextjsServerOptimizationData(optimization, {
          consent: { events: true, persistence: true },
          cookies: cookieStore,
          headers: headerStore,
          locale: APP_LOCALE,
        }).then(({ data }) => data)
      : undefined,
  ])

  const entriesById = toIdMap(entries)
  const autoEntry = entriesById.get(PAGES.pageTwo.auto)
  const manualEntry = entriesById.get(PAGES.pageTwo.manual)
  const autoResolved = autoEntry
    ? optimization.resolveOptimizedEntry(autoEntry, optimizationData?.selectedOptimizations)
    : undefined
  const manualResolved = manualEntry
    ? optimization.resolveOptimizedEntry(manualEntry, optimizationData?.selectedOptimizations)
    : undefined

  return (
    <section data-testid="page-two-view">
      <div className="page-header">
        <Link data-testid="link-back-home" href={PAGES.home.path}>
          Back to Home
        </Link>
        <h1>Page Two</h1>
      </div>

      <CustomViewTracker componentId="page-two-hero" />
      <ControlPanel demoCTA />

      <div className="sections-grid sections-grid--split" data-testid="page-two-optimization">
        <section className="page-section">
          <header className="page-section__header">
            <h2>Auto-observed</h2>
          </header>
          <div className="entry-grid">
            {autoEntry && autoResolved ? (
              <EntryCard
                baselineEntry={autoEntry}
                resolvedData={autoResolved}
                viewTracking="auto"
              />
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
            {manualEntry && manualResolved ? (
              <EntryCard
                baselineEntry={manualEntry}
                resolvedData={manualResolved}
                viewTracking="manual"
              />
            ) : (
              <p>Manual tracked entry is unavailable.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
