import { AppShell } from '@/components/AppShell'
import { ControlPanel } from '@/components/ControlPanel'
import { EntryCard } from '@/components/EntryCard'
import { GlobalLiveUpdatesProvider } from '@/components/GlobalLiveUpdatesProvider'
import { PreviewPanel } from '@/components/PreviewPanel'
import { loadPageEntries } from '@/lib/contentful'
import { NextAppAutoPageTracker, OptimizationRoot } from '@/lib/optimization'
import { createCurrentRequestHandoff } from '@/lib/request-handoff'
import { CLICK_SCENARIOS, PAGES } from 'e2e-web'
import { connection } from 'next/server'
import { Suspense } from 'react'

export async function PrivateRequestSlot() {
  await connection()

  const { handoff, pagePayload, routeKey } = await createCurrentRequestHandoff()
  const [entry] = await loadPageEntries([PAGES.home.liveUpdates])

  return (
    <OptimizationRoot buildPagePayload={() => pagePayload} handoff={handoff} routeKey={routeKey}>
      <GlobalLiveUpdatesProvider>
        <PreviewPanel />
        <Suspense>
          <NextAppAutoPageTracker initialPageEvent={handoff.initialPageEvent} />
        </Suspense>
        <section data-cache-scope={handoff.cache.scope} data-testid="private-request-slot">
          <AppShell>
            <div className="page-header">
              <h1>Static Shell Private Slot</h1>
              <p className="page-header__subtitle">
                Static shell with request-personalized content isolated in a private slot.
              </p>
            </div>

            <ControlPanel />

            <section className="page-section" data-testid="private-slot-personalized-content">
              <header className="page-section__header">
                <h2>Request-personalized content</h2>
              </header>
              <div className="entry-grid">
                {entry ? (
                  <EntryCard
                    baselineEntry={entry}
                    clickScenario={CLICK_SCENARIOS[entry.sys.id]}
                    manualTracking={false}
                  />
                ) : (
                  <p data-testid="private-slot-missing-entry">Entry is unavailable.</p>
                )}
              </div>
            </section>
          </AppShell>
        </section>
      </GlobalLiveUpdatesProvider>
    </OptimizationRoot>
  )
}
