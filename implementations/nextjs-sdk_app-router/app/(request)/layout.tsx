import { AppShellBody, AppShellChrome } from '@/components/AppShell'
import { GlobalLiveUpdatesProvider } from '@/components/GlobalLiveUpdatesProvider'
import { PreviewPanel } from '@/components/PreviewPanel'
import { RequestOptimizationProvider } from '@/lib/optimization'
import { connection } from 'next/server'
import type { ReactNode } from 'react'

export default async function RequestLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  await connection()

  return (
    <AppShellChrome>
      <RequestOptimizationProvider>
        <GlobalLiveUpdatesProvider>
          <PreviewPanel />
          <AppShellBody>{children}</AppShellBody>
        </GlobalLiveUpdatesProvider>
      </RequestOptimizationProvider>
    </AppShellChrome>
  )
}
