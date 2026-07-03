import { GlobalLiveUpdatesProvider } from '@/components/GlobalLiveUpdatesProvider'
import { PreviewPanel } from '@/components/PreviewPanel'
import { TrackingLog } from '@/components/TrackingLog'
import { appConfig } from '@/lib/config'
import { getOptimizationData } from '@/lib/optimization'
import { getAppConsent } from '@/lib/util'
import { NextAppAutoPageTracker, OptimizationRoot } from '@contentful/optimization-nextjs/client'
import 'e2e-web/theme.css'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Optimization Next.js SDK Hybrid',
  description:
    'Next.js App Router reference: the Next.js SDK resolves entries server-side for first paint and takes over client-side reactivity and SPA navigation.',
}
export const dynamic = 'force-dynamic'

function getHtmlLang(locale: string | undefined): string {
  return locale?.split('-')[0] ?? 'en'
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const cookieStore = await cookies()
  const appConsent = getAppConsent(cookieStore)
  const htmlLang = getHtmlLang(appConfig.locale)
  // Seed the provider with server-resolved state (deduplicated per request with
  // the pages) so first paint is personalized before the browser takes over.
  const serverOptimizationState = await getOptimizationData()

  return (
    <html lang={htmlLang}>
      <body>
        <OptimizationRoot
          clientId={appConfig.clientId}
          environment={appConfig.environment}
          locale={appConfig.locale}
          api={appConfig.api}
          trackEntryInteraction={{ views: true, clicks: true, hovers: true }}
          logLevel="debug"
          app={{
            name: 'Contentful Optimization Next.js SDK Hybrid (Client)',
            version: '0.1.0',
          }}
          defaults={{ consent: appConsent, persistenceConsent: appConsent }}
          serverOptimizationState={serverOptimizationState}
        >
          <GlobalLiveUpdatesProvider>
            <PreviewPanel />
            <Suspense>
              <NextAppAutoPageTracker initialPageEvent="skip" />
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
