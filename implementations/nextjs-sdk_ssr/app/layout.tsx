import { GlobalLiveUpdatesProvider } from '@/components/GlobalLiveUpdatesProvider'
import { PreviewPanel } from '@/components/PreviewPanel'
import { TrackingLog } from '@/components/TrackingLog'
import { APP_LOCALE, APP_PERSONALIZATION_CONSENT_COOKIE, optimizationConfig } from '@/lib/config'
import { NextAppAutoPageTracker, OptimizationRoot } from '@contentful/optimization-nextjs/client'
import 'e2e-web/theme.css'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Optimization Next.js SDK SSR',
  description:
    'Next.js App Router reference: the Next.js SDK resolves entries server-side and handles client-side tracking and interactive controls.',
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies()
  const appConsent = cookieStore.get(APP_PERSONALIZATION_CONSENT_COOKIE)?.value === 'granted'

  return (
    <html lang={APP_LOCALE.split('-')[0]}>
      <body>
        <OptimizationRoot
          clientId={optimizationConfig.clientId}
          environment={optimizationConfig.environment}
          locale={APP_LOCALE}
          api={optimizationConfig.api}
          trackEntryInteraction={{ views: true, clicks: true, hovers: true }}
          logLevel="debug"
          app={{
            name: 'Contentful Optimization Next.js SDK SSR (Client)',
            version: '0.1.0',
          }}
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
