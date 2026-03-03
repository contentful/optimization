import type { ReactElement } from 'react'
import { useLiveUpdates, useOptimization } from '../src'

const sectionTitles = [
  'Consent',
  'Identify / Reset',
  'State Inspectors',
  'Event Stream',
  'Entry Resolver',
  'Entry Rendering / Observation',
] as const

export function App(): ReactElement {
  useOptimization()
  const liveUpdates = useLiveUpdates()?.globalLiveUpdates ?? false

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <h1>@contentful/optimization-react-web</h1>
        <p>Minimal live integration with OptimizationRoot config props.</p>
      </header>

      <section className="dashboard__grid" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
        <article className="dashboard__card">
          <h2>SDK Wiring</h2>
          <p>Optimization SDK: READY</p>
          <p>{`Global liveUpdates: ${liveUpdates ? 'ON' : 'OFF'}`}</p>
        </article>
      </section>

      <section className="dashboard__grid">
        {sectionTitles.map((title) => (
          <article className="dashboard__card" key={title}>
            <h2>{title}</h2>
            <p>Scaffold placeholder. Runtime behavior will be implemented in follow-up tickets.</p>
          </article>
        ))}
      </section>
    </main>
  )
}
