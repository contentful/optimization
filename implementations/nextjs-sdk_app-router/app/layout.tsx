import { appConfig } from '@/lib/config'
import 'e2e-web/theme.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Optimization Next.js SDK App Router',
  description:
    'Next.js App Router reference: the Next.js SDK resolves entries server-side for first paint and takes over client-side reactivity and SPA navigation.',
}

function getHtmlLang(locale: string | undefined): string {
  return locale?.split('-')[0] ?? 'en'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang={getHtmlLang(appConfig.locale)}>
      <body>{children}</body>
    </html>
  )
}
