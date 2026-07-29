import { LiveEntryCard } from '@/components/LiveEntryCard'
import { loadPageEntries } from '@/lib/contentful'
import { PAGES } from 'e2e-web'
import { RequestRouteShell } from '../RequestRouteShell'

export default async function HiddenUntilReadyPage() {
  const [entry] = await loadPageEntries([PAGES.home.liveUpdates])

  return (
    <RequestRouteShell>
      <section className="page-section" data-testid="hidden-until-ready-route">
        <header className="page-section__header">
          <h1>Hidden Until Ready</h1>
        </header>
        {entry ? (
          <LiveEntryCard entry={entry} liveUpdates={false} testId="hidden-until-ready" />
        ) : (
          <p data-testid="hidden-until-ready-missing">Entry is unavailable.</p>
        )}
      </section>
    </RequestRouteShell>
  )
}
