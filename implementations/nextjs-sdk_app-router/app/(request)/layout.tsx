import { AppShell } from '@/components/AppShell'
import { GlobalLiveUpdatesProvider } from '@/components/GlobalLiveUpdatesProvider'
import { PreviewPanel } from '@/components/PreviewPanel'
import { NextAppAutoPageTracker, OptimizationRoot } from '@/lib/optimization'
import { createCurrentRequestHandoff } from '@/lib/request-handoff'
import { connection } from 'next/server'
import { Suspense, type ReactNode } from 'react'

async function RequestRuntime({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  await connection()

  const { handoff, pagePayload, routeKey } = await createCurrentRequestHandoff()

  return (
    <OptimizationRoot buildPagePayload={() => pagePayload} handoff={handoff} routeKey={routeKey}>
      <GlobalLiveUpdatesProvider>
        <PreviewPanel />
        <Suspense>
          <NextAppAutoPageTracker initialPageEvent={handoff.initialPageEvent} />
        </Suspense>
        <AppShell>{children}</AppShell>
      </GlobalLiveUpdatesProvider>
    </OptimizationRoot>
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
