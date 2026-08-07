import { AppShell } from '@/components/AppShell'
import { ControlPanel } from '@/components/ControlPanel'
import { EntryCard } from '@/components/EntryCard'
import { GlobalLiveUpdatesProvider } from '@/components/GlobalLiveUpdatesProvider'
import { PreviewPanel } from '@/components/PreviewPanel'
import { loadPageEntries } from '@/lib/contentful'
import { RequestNextAppAutoPageTracker, RequestOptimizationRoot } from '@/lib/optimization'
import { CLICK_SCENARIOS, PAGES } from 'e2e-web'
import { connection } from 'next/server'

export async function PrivateRequestSlot() {
  await connection()

  const [entry] = await loadPageEntries([PAGES.home.liveUpdates])

  return (
    <RequestOptimizationRoot>
      <GlobalLiveUpdatesProvider>
        <PreviewPanel />
        <RequestNextAppAutoPageTracker />
        <section data-testid="private-request-slot">
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
    </RequestOptimizationRoot>
  )
}
