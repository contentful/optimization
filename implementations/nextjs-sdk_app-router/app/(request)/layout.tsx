import { AppShell } from '@/components/AppShell'
import { GlobalLiveUpdatesProvider } from '@/components/GlobalLiveUpdatesProvider'
import { PreviewPanel } from '@/components/PreviewPanel'
import { RequestNextAppAutoPageTracker, RequestOptimizationRoot } from '@/lib/optimization'
import { connection } from 'next/server'
import { Suspense, type ReactNode } from 'react'

async function RequestRuntime({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  await connection()

  return (
    <RequestOptimizationRoot>
      <GlobalLiveUpdatesProvider>
        <PreviewPanel />
        <RequestNextAppAutoPageTracker />
        <AppShell>{children}</AppShell>
      </GlobalLiveUpdatesProvider>
    </RequestOptimizationRoot>
  )
}

export default function RequestLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <Suspense fallback={null}>
      <RequestRuntime>{children}</RequestRuntime>
    </Suspense>
  )
}
