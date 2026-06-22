import { AnalyticsEventDisplay } from '@/components/AnalyticsEventDisplay'
import { APP_LOCALE, optimizationConfig } from '@/lib/config'
import { NextAppAutoPageTracker, OptimizationRoot } from '@contentful/optimization-nextjs/client'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Optimization Next.js SDK SSR',
  description:
    'Next.js App Router reference: the Next.js SDK resolves entries server-side and handles client-side tracking and interactive controls.',
}

function getHtmlLang(locale: string | undefined): string {
  return locale?.split('-')[0] ?? 'en'
}

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const cookieStore = await cookies()
  const appConsent = cookieStore.get(APP_PERSONALIZATION_CONSENT_COOKIE)?.value === 'granted'
  const htmlLang = getHtmlLang(APP_LOCALE)

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
          app={{
            name: 'Contentful Optimization Next.js SDK SSR (Client)',
            version: '0.1.0',
          }}
        >
          <Suspense>
            <NextAppAutoPageTracker initialPageEvent={appConsent ? 'skip' : 'emit'} />
          </Suspense>
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
        </OptimizationRoot>
      </body>
    </html>
  )
}
