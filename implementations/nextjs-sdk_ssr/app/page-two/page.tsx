import { ControlPanel } from '@/components/ControlPanel'
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
      <h2>Page Two</h2>

      <ControlPanel />

      <section className="page-section" data-testid="page-two-optimization">
        <header className="page-section__header">
          <h3>Page Two Optimized Content</h3>
        </header>
        {autoEntry && autoResolved ? (
          <div>
            <p>Auto tracked example</p>
            <EntryCard baselineEntry={autoEntry} resolvedData={autoResolved} viewTracking="auto" />
          </div>
        ) : (
          <p>Auto tracked entry is unavailable.</p>
        )}
        {manualEntry && manualResolved ? (
          <div>
            <p>Manual tracked example</p>
            <EntryCard
              baselineEntry={manualEntry}
              resolvedData={manualResolved}
              viewTracking="manual"
            />
          </div>
        ) : (
          <p>Manual tracked entry is unavailable.</p>
        )}
      </section>

      <Link data-testid="link-back-home" href={PAGES.home.path}>
        Back to Home
      </Link>
    </section>
  )
}
