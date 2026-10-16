import type { ReactElement } from 'react'
import { LiveUpdatesProvider, OptimizationProvider, type OptimizationSdk } from '../../../src'
import { useOptimizationContext } from '../../../src/hooks/useOptimization'

function DecoupledConsumer({ label }: { label: string }): ReactElement {
  const { sdk, error } = useOptimizationContext()

  return (
    <p>
      {label}: {error ? `Error — ${error.message}` : sdk ? 'SDK ready' : 'Initializing...'}
    </p>
  )
}

function ContextConsumer(): ReactElement {
  const { sdk, error } = useOptimizationContext()

  return (
    <article className="dashboard__card">
      <h2>useOptimizationContext()</h2>
      <p>{`sdk: ${sdk ? 'present' : 'undefined'}`}</p>
      <p>{`error: ${error ? error.message : 'none'}`}</p>
    </article>
  )
}

interface ProvidersSectionProps {
  sdk: OptimizationSdk
}

export function ProvidersSection({ sdk }: ProvidersSectionProps): ReactElement {
  return (
    <section className="dashboard__grid">
      <article className="dashboard__card">
        <h2>Decoupled Providers (config)</h2>
        <p>OptimizationProvider + LiveUpdatesProvider without OptimizationRoot.</p>
        <p>
          <a href="/?provider=config">Open the config-owned provider example</a> as the page's only
          SDK owner.
        </p>
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
