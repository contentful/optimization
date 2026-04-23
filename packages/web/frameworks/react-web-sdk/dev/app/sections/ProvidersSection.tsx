import type { ReactElement } from 'react'
import { LiveUpdatesProvider, OptimizationProvider, type OptimizationSdk } from '../../../src'
import { useOptimizationContext } from '../../../src/hooks/useOptimization'

function DecoupledConsumer({ label }: { label: string }): ReactElement {
  const { sdk, isReady, error } = useOptimizationContext()

  return (
    <p>
      {label}:{' '}
      {error ? `Error — ${error.message}` : isReady && sdk ? 'SDK ready' : 'Initializing...'}
    </p>
  )
}

function ContextConsumer(): ReactElement {
  const { sdk, isReady, error } = useOptimizationContext()

  return (
    <article className="dashboard__card">
      <h2>useOptimizationContext()</h2>
      <p>{`isReady: ${String(isReady)}`}</p>
      <p>{`sdk: ${sdk ? 'present' : 'undefined'}`}</p>
      <p>{`error: ${error ? error.message : 'none'}`}</p>
    </article>
  )
}

interface ProvidersSectionProps {
  clientId: string
  environment: string
  insightsBaseUrl: string
  experienceBaseUrl: string
  sdk: OptimizationSdk
}

export function ProvidersSection({
  clientId,
  environment,
  insightsBaseUrl,
  experienceBaseUrl,
  sdk,
}: ProvidersSectionProps): ReactElement {
  return (
    <section className="dashboard__grid">
      <article className="dashboard__card">
        <h2>Decoupled Providers (config)</h2>
        <p>OptimizationProvider + LiveUpdatesProvider without OptimizationRoot.</p>
        <OptimizationProvider
          clientId={clientId}
          environment={environment}
          api={{ insightsBaseUrl, experienceBaseUrl }}
        >
          <LiveUpdatesProvider globalLiveUpdates={false}>
            <DecoupledConsumer label="Config-based" />
          </LiveUpdatesProvider>
        </OptimizationProvider>
      </article>

      <article className="dashboard__card">
        <h2>Decoupled Providers (sdk prop)</h2>
        <p>OptimizationProvider with a pre-created SDK instance.</p>
        <OptimizationProvider sdk={sdk}>
          <LiveUpdatesProvider globalLiveUpdates={false}>
            <DecoupledConsumer label="SDK-injected" />
          </LiveUpdatesProvider>
        </OptimizationProvider>
      </article>

      <ContextConsumer />
    </section>
  )
}
