import { TrackingLog } from '@/components/TrackingLog'
import Link from 'next/link'
import { type JSX, type ReactNode } from 'react'

export function AppShell({
  analyticsOnly = false,
  children,
}: Readonly<{
  analyticsOnly?: boolean
  children: ReactNode
}>): JSX.Element {
  return (
    <div className="app-shell">
      <nav>
        <Link data-testid="link-home" href="/">
          Home
        </Link>
        <Link data-testid="link-page-two" href="/page-two">
          Page Two
        </Link>
        <Link data-testid="link-selection-handoff" href="/selection-handoff/new-visitor">
          Selection Handoff
        </Link>
        <Link data-testid="link-analytics-only" href="/analytics-only/new-visitor">
          Analytics Only
        </Link>
        <Link data-testid="link-hidden-ready" href="/hidden-until-ready">
          Hidden Until Ready
        </Link>
      </nav>
      <div className="app-body">
        <aside className="app-sidebar">
          {analyticsOnly ? (
            <section className="tracking-log" data-testid="analytics-only-sidebar">
              <div className="tracking-log__header">
                <h2>Tracking</h2>
              </div>
              <p className="tracking-log__empty">
                Analytics-only runtime is mounted for this route.
              </p>
            </section>
          ) : (
            <TrackingLog />
          )}
        </aside>
        <main>{children}</main>
      </div>
    </div>
  )
}
