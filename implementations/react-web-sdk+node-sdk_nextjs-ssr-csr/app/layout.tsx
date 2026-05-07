import { ClientProviderWrapper } from '@/components/ClientProviderWrapper'
import { getOptimizationData } from '@/lib/optimization-server'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Optimization Next.js Hybrid SSR + CSR Takeover',
  description:
    'Next.js App Router reference: Node SDK resolves entries server-side for first paint, React SDK takes over for client-side reactivity and SPA navigation.',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const optimizationData = await getOptimizationData()

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ClientProviderWrapper
          defaults={{
            profile: optimizationData.profile,
            selectedOptimizations: optimizationData.selectedOptimizations,
            changes: optimizationData.changes,
          }}
        >
          {children}
        </ClientProviderWrapper>
      </body>
    </html>
  )
}
