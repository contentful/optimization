import { type ReactElement, useMemo, useState } from 'react'
import { useLiveUpdates, useOptimization } from '../src'
import { BASELINE_IDS } from './constants'
import { useDevEntries } from './hooks/useDevEntries'
import { useOptimizationState } from './hooks/useOptimizationState'
import { ControlsSection } from './sections/ControlsSection'
import { PersonalizationSection } from './sections/PersonalizationSection'
import { StateSection } from './sections/StateSection'
import type { ResolveResult } from './types'

export function App(): ReactElement {
  const { sdk: contentfulOptimization, isReady, error } = useOptimization()
  const { globalLiveUpdates, previewPanelVisible } = useLiveUpdates()
  const { entriesById, loading: entriesLoading, error: entriesError } = useDevEntries()
  const { consent, profile, personalizations, previewPanelOpen, eventLog } =
    useOptimizationState(contentfulOptimization)
  const [resolveResults, setResolveResults] = useState<ResolveResult[]>([])

  if (!isReady || contentfulOptimization === undefined) {
    return <main className="dashboard">{error?.message ?? 'Optimization SDK unavailable.'}</main>
  }

  const baselineDefault = entriesById.get(BASELINE_IDS.default)
  const baselineLive = entriesById.get(BASELINE_IDS.live)
  const baselineLocked = entriesById.get(BASELINE_IDS.locked)
  const baselineNestedParent = entriesById.get(BASELINE_IDS.nestedParent)
  const baselineNestedChild = entriesById.get(BASELINE_IDS.nestedChild)

  const { size: resolvedEntryCount } = entriesById
  const sdkName = useMemo(() => contentfulOptimization.constructor.name, [contentfulOptimization])

  const handleResolveEntries = (): void => {
    const nextResults: ResolveResult[] = []

    entriesById.forEach((entry) => {
      const resolved = contentfulOptimization.personalizeEntry(entry, personalizations)
      nextResults.push({
        baselineId: entry.sys.id,
        resolvedId: resolved.entry.sys.id,
        personalizationId: resolved.personalization?.experienceId,
        variantIndex: resolved.personalization?.variantIndex,
        sticky: resolved.personalization?.sticky,
      })
    })

    setResolveResults(nextResults)
  }

  const fireAndReport = (promise: Promise<unknown>): void => {
    void promise.catch(() => null)
  }

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <h1>@contentful/optimization-react-web</h1>
        <p>Dev app split into modules for easier review and iteration.</p>
      </header>

      <section className="dashboard__grid" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
        <article className="dashboard__card">
          <h2>SDK Wiring</h2>
          <p>OptimizationRoot: Active</p>
          <p>{`ContentfulOptimization SDK: ${sdkName}`}</p>
          <p>{`Global liveUpdates: ${globalLiveUpdates ? 'ON' : 'OFF'}`}</p>
          <p>{`Preview panel visible: ${previewPanelVisible ? 'Open' : 'Closed'}`}</p>
        </article>
      </section>

      <ControlsSection
        consent={consent}
        eventLog={eventLog}
        onGrantConsent={() => {
          contentfulOptimization.consent(true)
        }}
        onRevokeConsent={() => {
          contentfulOptimization.consent(false)
        }}
        onIdentify={() => {
          fireAndReport(
            contentfulOptimization.identify({
              userId: 'demo-user-123',
              traits: { plan: 'pro', region: 'eu', source: 'react-web-sdk-dev' },
            }),
          )
        }}
        onReset={() => {
          contentfulOptimization.reset()
        }}
        onSendPage={() => {
          fireAndReport(
            contentfulOptimization.page({
              properties: { title: 'React Web SDK Dev Harness', path: '/dev' },
            }),
          )
        }}
        onSendTrack={() => {
          fireAndReport(
            contentfulOptimization.track({
              event: 'dev_app_custom_event',
              properties: { source: 'react-web-sdk/dev/App.tsx' },
            }),
          )
        }}
      />

      <StateSection
        globalLiveUpdates={globalLiveUpdates}
        previewPanelVisible={previewPanelVisible}
        previewPanelOpen={previewPanelOpen}
        personalizations={personalizations}
        profile={profile}
        entriesLoadedCount={resolvedEntryCount}
        entriesLoading={entriesLoading}
        entriesError={entriesError}
        resolveResults={resolveResults}
        onResolveEntries={handleResolveEntries}
      />

      <PersonalizationSection
        baselineDefault={baselineDefault}
        baselineLive={baselineLive}
        baselineLocked={baselineLocked}
        baselineNestedParent={baselineNestedParent}
        baselineNestedChild={baselineNestedChild}
        personalizations={personalizations}
      />
    </main>
  )
}
