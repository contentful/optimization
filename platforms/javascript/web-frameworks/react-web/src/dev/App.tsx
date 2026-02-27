import type { ReactElement } from 'react'

const sectionTitles = [
  'Consent',
  'Identify / Reset',
  'State Inspectors',
  'Event Stream',
  'Entry Resolver',
  'Entry Rendering / Observation',
] as const

export function App(): ReactElement {
  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <h1>@contentful/optimization-react-web</h1>
        <p>Scaffold dashboard for React Web SDK development.</p>
      </header>

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
