import { ClientProviderWrapper } from '@/components/ClientProviderWrapper'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Optimization Next.js CSR Reference',
  description:
    'Next.js App Router reference using @contentful/optimization-react-web for pure client-side entry resolution.',
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
