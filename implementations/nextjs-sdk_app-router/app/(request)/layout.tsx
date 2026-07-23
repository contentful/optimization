import { AppShell } from '@/components/AppShell'
import { GlobalLiveUpdatesProvider } from '@/components/GlobalLiveUpdatesProvider'
import { PreviewPanel } from '@/components/PreviewPanel'
import { NextAppAutoPageTracker, OptimizationRoot } from '@/lib/optimization'
import { Suspense, type ReactNode } from 'react'
import { createCurrentRequestHandoff } from './request-handoff'

export const dynamic = 'force-dynamic'

export default async function RequestLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
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
