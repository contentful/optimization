import { AppShellBody } from '@/components/AppShell'
import { ControlPanel } from '@/components/ControlPanel'
import { ManagedEntryCard } from '@/components/EntryCard'
import { GlobalLiveUpdatesProvider } from '@/components/GlobalLiveUpdatesProvider'
import { PreviewPanel } from '@/components/PreviewPanel'
import { RequestOptimizationRoot } from '@/lib/optimization'
import { PAGES } from 'e2e-web'
import { connection } from 'next/server'

export async function PrivateRequestSlot() {
  await connection()

  const entryId = PAGES.home.liveUpdates

  return (
    <RequestOptimizationRoot prefetchManagedEntries={[entryId]}>
      <GlobalLiveUpdatesProvider>
        <PreviewPanel />
        <section data-testid="private-request-slot">
          <AppShellBody>
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
                <ManagedEntryCard entryId={entryId} />
              </div>
            </section>
          </AppShellBody>
        </section>
      </GlobalLiveUpdatesProvider>
    </RequestOptimizationRoot>
  )
}
