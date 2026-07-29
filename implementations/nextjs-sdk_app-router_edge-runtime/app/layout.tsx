import { appConfig } from '@/lib/config'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Optimization Next.js SDK Edge runtime',
  description: 'Next.js App Router Edge runtime reference for Contentful Optimization handoffs.',
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
