import { ControlPanel } from '@/components/ControlPanel'
import { EntryCard } from '@/components/EntryCard'
import { APP_LOCALE, APP_PERSONALIZATION_CONSENT_COOKIE } from '@/lib/config'
import { loadPageEntries } from '@/lib/contentful'
import { optimization } from '@/lib/optimization'
import { toIdMap } from '@/lib/util'
import { getNextjsServerOptimizationData } from '@contentful/optimization-nextjs/server'
import { CLICK_SCENARIOS, PAGES } from 'e2e-web'
import { cookies, headers } from 'next/headers'

export default async function Home() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const appConsent = cookieStore.get(APP_PERSONALIZATION_CONSENT_COOKIE)?.value === 'granted'

  const [entries, optimizationData] = await Promise.all([
    loadPageEntries(PAGES.home.ids),
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
  const resolvedById = new Map(
    entries.map((entry) => [
      entry.sys.id,
      optimization.resolveOptimizedEntry(entry, optimizationData?.selectedOptimizations),
    ]),
  )

  return (
    <>
      <ControlPanel />

      <section className="page-section" data-testid="auto-observed-section">
        <header className="page-section__header">
          <h2>Auto Observed Entries</h2>
        </header>
        <div id="auto-observed" className="entry-grid">
          {PAGES.home.auto.flatMap((id) => {
            const entry = entriesById.get(id)
            const resolvedData = resolvedById.get(id)
            if (!entry || !resolvedData) return []
            return [
              <EntryCard
                key={id}
                baselineEntry={entry}
                clickScenario={CLICK_SCENARIOS[id]}
                resolvedData={resolvedData}
                viewTracking="auto"
              />,
            ]
          })}
        </div>
      </section>

      <section className="page-section" data-testid="manually-observed-section">
        <header className="page-section__header">
          <h2>Manually Observed Entries</h2>
        </header>
        <div id="manually-observed" className="entry-grid">
          {PAGES.home.manual.flatMap((id) => {
            const entry = entriesById.get(id)
            const resolvedData = resolvedById.get(id)
            if (!entry || !resolvedData) return []
            return [
              <EntryCard
                key={id}
                baselineEntry={entry}
                resolvedData={resolvedData}
                viewTracking="manual"
              />,
            ]
          })}
        </div>
      </section>
    </>
  )
}
