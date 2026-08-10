import { AppShellChrome, PersonalizedContentFallback } from '@/components/AppShell'
import { Suspense } from 'react'
import { PrivateRequestSlot } from './PrivateRequestSlot'

export default function StaticShellPrivateSlotPage() {
  return (
    <AppShellChrome>
      <section className="page-section" data-testid="static-shell-private-slot-shell">
        <header className="page-section__header">
          <h1>Static Shell</h1>
          <p>Public navigation and context remain available while personalized content loads.</p>
        </header>
        <Suspense fallback={<PersonalizedContentFallback />}>
          <PrivateRequestSlot />
        </Suspense>
      </section>
    </AppShellChrome>
  )
}
