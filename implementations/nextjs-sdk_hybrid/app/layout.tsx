import { AnalyticsEventDisplay } from '@/components/AnalyticsEventDisplay'
import { GlobalLiveUpdatesProvider } from '@/components/GlobalLiveUpdatesProvider'
import { PreviewPanelAttachment } from '@/components/PreviewPanelAttachment'
import { APP_LOCALE, optimizationConfig } from '@/lib/config'
import { getOptimizationData } from '@/lib/optimization-server'
import { NextAppAutoPageTracker, OptimizationRoot } from '@contentful/optimization-nextjs/client'
import type { Metadata } from 'next'
import Link from 'next/link'
import { type ReactNode } from 'react'
import './globals.css'

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
    <html lang={htmlLang} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
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
            <PreviewPanelAttachment />
            <NextAppAutoPageTracker initialPageEvent={defaults ? 'skip' : 'emit'} />
            <main className="flex-1 p-8 max-w-3xl mx-auto w-full grid gap-6">
              <nav className="flex gap-3">
                <Link data-testid="link-home" href="/">
                  Home
                </Link>
                <Link data-testid="link-page-two" href="/page-two">
                  Go to Page Two
                </Link>
              </nav>
              {children}
              <AnalyticsEventDisplay />
            </main>
          </GlobalLiveUpdatesProvider>
        </OptimizationRoot>
      </body>
    </html>
  )
}
