import { type ReactElement, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useLiveUpdates, useOptimization } from '../../src'
import { BASELINE_IDS } from './constants'
import { useDevEntries } from './hooks/useDevEntries'
import { useOptimizationState } from './hooks/useOptimizationState'
import { ControlsSection } from './sections/ControlsSection'
import { OptimizationSection } from './sections/OptimizationSection'
import { StateSection } from './sections/StateSection'
import type { ResolveResult } from './types'

const DEV_ROUTES = [
  { to: '/', label: 'Overview', description: 'Root route for initial auto page events.' },
  { to: '/events', label: 'Events', description: 'Route changes exercise page-event emission.' },
  {
    to: '/optimization',
    label: 'Optimization',
    description: 'Route changes keep optimization state visible.',
  },
] as const

export function App(): ReactElement {
  const location = useLocation()
  const { sdk } = useOptimization()
  const { globalLiveUpdates, previewPanelVisible } = useLiveUpdates()
  const { entriesById, loading: entriesLoading, error: entriesError } = useDevEntries()
  const { consent, profile, selectedOptimizations, previewPanelOpen, eventLog } =
    useOptimizationState(sdk)
  const [resolveResults, setResolveResults] = useState<ResolveResult[]>([])

  const baselineDefault = entriesById.get(BASELINE_IDS.default)
  const baselineLive = entriesById.get(BASELINE_IDS.live)
  const baselineLocked = entriesById.get(BASELINE_IDS.locked)
  const baselineNestedParent = entriesById.get(BASELINE_IDS.nestedParent)
  const baselineNestedChild = entriesById.get(BASELINE_IDS.nestedChild)

  const { size: resolvedEntryCount } = entriesById
  const sdkName = useMemo(() => sdk.constructor.name, [sdk])
  const activeRoute =
    DEV_ROUTES.find(({ to }) => to === location.pathname)?.description ??
    'Custom route used to validate auto page tracking.'

  const handleResolveEntries = (): void => {
    const nextResults: ResolveResult[] = []

    entriesById.forEach((entry) => {
      const resolved = sdk.resolveOptimizedEntry(entry, selectedOptimizations)
      nextResults.push({
        baselineId: entry.sys.id,
        resolvedId: resolved.entry.sys.id,
        optimizationId: resolved.selectedOptimization?.experienceId,
        variantIndex: resolved.selectedOptimization?.variantIndex,
        sticky: resolved.selectedOptimization?.sticky,
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
        <p>Dev app wired to the React Router auto-page adapter.</p>
        <nav className="dashboard__nav" aria-label="Dev routes">
          {DEV_ROUTES.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive ? 'dashboard__nav-link dashboard__nav-link--active' : 'dashboard__nav-link'
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <section className="dashboard__grid" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
        <article className="dashboard__card">
          <h2>SDK Wiring</h2>
          <p>OptimizationRoot: Active</p>
          <p>Auto page adapter: React Router</p>
          <p>{`Current route: ${location.pathname}${location.search}${location.hash}`}</p>
          <p>{activeRoute}</p>
          <p>{`ContentfulOptimization SDK: ${sdkName}`}</p>
          <p>{`Global liveUpdates: ${globalLiveUpdates ? 'ON' : 'OFF'}`}</p>
          <p>{`Preview panel visible: ${previewPanelVisible ? 'Open' : 'Closed'}`}</p>
        </article>
      </section>

      <ControlsSection
        consent={consent}
        eventLog={eventLog}
        onGrantConsent={() => {
          sdk.consent(true)
        }}
        onRevokeConsent={() => {
          sdk.consent(false)
        }}
        onIdentify={() => {
          fireAndReport(
            sdk.identify({
              userId: 'demo-user-123',
              traits: { plan: 'pro', region: 'eu', source: 'react-web-sdk-dev' },
            }),
          )
        }}
        onReset={() => {
          sdk.reset()
        }}
        onSendPage={() => {
          fireAndReport(
            sdk.page({
              properties: {
                title: 'React Web SDK Dev Harness',
                path: location.pathname,
              },
            }),
          )
        }}
        onSendTrack={() => {
          fireAndReport(
            sdk.track({
              event: 'dev_app_custom_event',
              properties: { source: 'react-web-sdk/dev/app/App.tsx' },
            }),
          )
        }}
      />

      <StateSection
        globalLiveUpdates={globalLiveUpdates}
        previewPanelVisible={previewPanelVisible}
        previewPanelOpen={previewPanelOpen}
        selectedOptimizations={selectedOptimizations}
        profile={profile}
        entriesLoadedCount={resolvedEntryCount}
        entriesLoading={entriesLoading}
        entriesError={entriesError}
        resolveResults={resolveResults}
        onResolveEntries={handleResolveEntries}
      />

      <OptimizationSection
        baselineDefault={baselineDefault}
        baselineLive={baselineLive}
        baselineLocked={baselineLocked}
        baselineNestedParent={baselineNestedParent}
        baselineNestedChild={baselineNestedChild}
        selectedOptimizations={selectedOptimizations}
      />
    </main>
  )
}
