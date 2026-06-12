import { ClientProviderWrapper } from '@/components/ClientProviderWrapper'
import { APP_LOCALE } from '@/lib/config'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Optimization Next.js SSR Hybrid',
  description:
    'Next.js App Router reference: Node SDK resolves entries server-side, React SDK handles client-side tracking and interactive controls.',
}

function getHtmlLang(locale: string | undefined): string {
  return locale?.split('-')[0] ?? 'en'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const htmlLang = getHtmlLang(APP_LOCALE)

  return (
    <html lang={htmlLang} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ClientProviderWrapper appLocale={APP_LOCALE}>{children}</ClientProviderWrapper>
      </body>
    </html>
  )
}
