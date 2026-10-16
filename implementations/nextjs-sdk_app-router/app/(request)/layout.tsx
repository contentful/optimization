import { AppShellBody, AppShellChrome, PersonalizedContentFallback } from '@/components/AppShell'
import { GlobalLiveUpdatesProvider } from '@/components/GlobalLiveUpdatesProvider'
import { PreviewPanel } from '@/components/PreviewPanel'
import { RequestOptimizationRoot } from '@/lib/optimization'
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
        <AppShellBody>{children}</AppShellBody>
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
    <AppShellChrome>
      <Suspense fallback={<PersonalizedContentFallback />}>
        <RequestRuntime>{children}</RequestRuntime>
      </Suspense>
    </AppShellChrome>
  )
}
