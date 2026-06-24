import { GlobalLiveUpdatesProvider } from '@/components/GlobalLiveUpdatesProvider'
import { PreviewPanel } from '@/components/PreviewPanel'
import { TrackingLog } from '@/components/TrackingLog'
import { APP_LOCALE, optimizationConfig } from '@/lib/config'
import { getOptimizationData } from '@/lib/optimization'
import { NextAppAutoPageTracker, OptimizationRoot } from '@contentful/optimization-nextjs/client'
import 'e2e-web/theme.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { type ReactNode } from 'react'

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
  const optimizationData = await getOptimizationData()
  const htmlLang = getHtmlLang(APP_LOCALE)
  const defaults = optimizationData
    ? {
        profile: optimizationData.profile,
        selectedOptimizations: optimizationData.selectedOptimizations,
        changes: optimizationData.changes,
      }
    : undefined

  return (
    <html lang={htmlLang}>
      <body>
        <OptimizationRoot
          clientId={optimizationConfig.clientId}
          environment={optimizationConfig.environment}
          locale={APP_LOCALE}
          api={optimizationConfig.api}
          trackEntryInteraction={{ views: true, clicks: true, hovers: true }}
          logLevel="debug"
          defaults={defaults}
          app={{
            name: 'Contentful Optimization Next.js SDK Hybrid (Client)',
            version: '0.1.0',
          }}
        >
          <GlobalLiveUpdatesProvider>
            <PreviewPanel />
            <NextAppAutoPageTracker initialPageEvent={defaults ? 'skip' : 'emit'} />
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
