import { GlobalLiveUpdatesProvider } from '@/components/GlobalLiveUpdatesProvider'
import { PreviewPanel } from '@/components/PreviewPanel'
import { TrackingLog } from '@/components/TrackingLog'
import { appConfig } from '@/lib/config'
import { optimization } from '@/lib/optimization'
import { NextAppAutoPageTracker, OptimizationRoot } from '@contentful/optimization-nextjs/client'
import 'e2e-web/theme.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { type ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Optimization Next.js SDK SSR',
  description:
    'Next.js App Router reference: the Next.js SDK resolves entries server-side and handles client-side tracking and interactive controls.',
}

export const dynamic = 'force-dynamic'

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { defaults, initialPageEvent } = await optimization.getServerState()

  return (
    <html lang={appConfig.locale.split('-')[0]}>
      <body>
        <OptimizationRoot
          clientId={appConfig.clientId}
          environment={appConfig.environment}
          locale={appConfig.locale}
          api={appConfig.api}
          trackEntryInteraction={{ views: true, clicks: true, hovers: true }}
          logLevel="debug"
          defaults={defaults}
          app={{
            name: 'Contentful Optimization Next.js SDK SSR (Client)',
            version: '0.1.0',
          }}
        >
          <GlobalLiveUpdatesProvider>
            <PreviewPanel />
            <NextAppAutoPageTracker initialPageEvent={initialPageEvent} />
            <div className="app-shell">
              <nav>
                <Link data-testid="link-home" href="/">
                  Home
                </Link>
                <Link data-testid="link-page-two" href="/page-two">
                  Page Two
                </Link>
              </nav>
              <div className="app-body">
                <aside className="app-sidebar">
                  <TrackingLog />
                </aside>
                <main>{children}</main>
              </div>
            </div>
          </GlobalLiveUpdatesProvider>
        </OptimizationRoot>
      </body>
    </html>
  )
}
