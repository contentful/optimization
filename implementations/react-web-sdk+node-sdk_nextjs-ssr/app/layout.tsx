import { ClientProviderWrapper } from '@/components/ClientProviderWrapper'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Optimization Next.js SSR Hybrid',
  description:
    'Next.js App Router reference: Node SDK resolves entries server-side, React SDK handles client-side tracking and interactive controls.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ClientProviderWrapper>{children}</ClientProviderWrapper>
      </body>
    </html>
  )
}
