import { ClientProviderWrapper } from '@/components/ClientProviderWrapper'
import { getOptimizationData, requireContentfulLocale, sdk } from '@/lib/optimization-server'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Optimization Next.js Hybrid SSR + CSR Takeover',
  description:
    'Next.js App Router reference: Node SDK resolves entries server-side for first paint, React SDK takes over for client-side reactivity and SPA navigation.',
}

function getHtmlLang(locale: string | undefined): string {
  return locale?.split('-')[0] ?? 'en'
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headerStore = await headers()
  const { contentfulLocale, eventLocale } = sdk.resolveRequestLocale(
    headerStore.get('accept-language'),
  )
  const resolvedContentfulLocale = requireContentfulLocale(contentfulLocale)
  const optimizationData = await getOptimizationData(eventLocale, resolvedContentfulLocale)
  const htmlLang = getHtmlLang(resolvedContentfulLocale)
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
        <ClientProviderWrapper contentfulLocale={resolvedContentfulLocale} defaults={defaults}>
          {children}
        </ClientProviderWrapper>
      </body>
    </html>
  )
}
