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
    <AppShellChrome>
      <AppShellBody analyticsOnly={analyticsOnly}>{children}</AppShellBody>
    </AppShellChrome>
  )
}

export function AppShellChrome({ children }: Readonly<{ children: ReactNode }>): JSX.Element {
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
        <Link data-testid="link-static-private-slot" href="/static-shell-private-slot">
          Static Private Slot
        </Link>
      </nav>
      {children}
    </div>
  )
}

export function AppShellBody({
  analyticsOnly = false,
  children,
}: Readonly<{
  analyticsOnly?: boolean
  children: ReactNode
}>): JSX.Element {
  return (
    <div className="app-body">
      <aside className="app-sidebar">
        {analyticsOnly ? (
          <section className="tracking-log" data-testid="analytics-only-sidebar">
            <div className="tracking-log__header">
              <h2>Tracking</h2>
            </div>
            <p className="tracking-log__empty">Analytics-only runtime is mounted for this route.</p>
          </section>
        ) : (
          <TrackingLog />
        )}
      </aside>
      <main>{children}</main>
    </div>
  )
}

export function PersonalizedContentFallback(): JSX.Element {
  return (
    <div className="app-body">
      <main>
        <section
          aria-live="polite"
          className="page-section"
          data-testid="personalized-content-fallback"
          role="status"
        >
          <h1>Loading personalized content</h1>
          <p>The public navigation is ready while this content loads.</p>
        </section>
      </main>
    </div>
  )
}
