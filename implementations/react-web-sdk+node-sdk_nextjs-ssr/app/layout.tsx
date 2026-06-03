import { ClientProviderWrapper } from '@/components/ClientProviderWrapper'
import { requireContentfulLocale, sdk } from '@/lib/optimization-server'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'

export const metadata: Metadata = {
  title: 'Optimization Next.js SSR Hybrid',
  description:
    'Next.js App Router reference: Node SDK resolves entries server-side, React SDK handles client-side tracking and interactive controls.',
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
  const { contentfulLocale } = sdk.resolveRequestLocale(headerStore.get('accept-language'))
  const resolvedContentfulLocale = requireContentfulLocale(contentfulLocale)
  const htmlLang = getHtmlLang(resolvedContentfulLocale)

  return (
    <html lang={htmlLang} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ClientProviderWrapper contentfulLocale={resolvedContentfulLocale}>
          {children}
        </ClientProviderWrapper>
      </body>
    </html>
  )
}
