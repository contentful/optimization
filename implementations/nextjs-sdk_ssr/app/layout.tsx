import { GlobalLiveUpdatesProvider } from '@/components/GlobalLiveUpdatesProvider'
import { PreviewPanel } from '@/components/PreviewPanel'
import { TrackingLog } from '@/components/TrackingLog'
import { appConfig } from '@/lib/config'
import { optimization } from '@/lib/optimization'
import { getAppConsent } from '@/lib/util'
import { NextAppAutoPageTracker, OptimizationRoot } from '@contentful/optimization-nextjs/client'
import { getNextjsServerOptimizationData } from '@contentful/optimization-nextjs/server'
import 'e2e-web/theme.css'
import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Optimization Next.js SDK SSR',
  description:
    'Next.js App Router reference: the Next.js SDK resolves entries server-side and handles client-side tracking and interactive controls.',
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
  const appConsent = getAppConsent(cookieStore)

  // Resolve the request-scoped optimization state on the server so the
  // isomorphic provider renders identified/personalized first-paint state even
  // with JavaScript disabled. Only fetched when consent permits it.
  const serverOptimizationState = appConsent
    ? await getNextjsServerOptimizationData(optimization, {
        consent: { events: true, persistence: true },
        cookies: cookieStore,
        headers: headerStore,
        locale: appConfig.locale,
      }).then(({ data }) => data)
    : undefined

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
          app={{
            name: 'Contentful Optimization Next.js SDK SSR (Client)',
            version: '0.1.0',
          }}
          defaults={{ consent: appConsent, persistenceConsent: appConsent }}
          serverOptimizationState={serverOptimizationState}
        >
          <GlobalLiveUpdatesProvider>
            <PreviewPanel />
            <Suspense>
              <NextAppAutoPageTracker initialPageEvent={appConsent ? 'skip' : 'emit'} />
            </Suspense>
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
