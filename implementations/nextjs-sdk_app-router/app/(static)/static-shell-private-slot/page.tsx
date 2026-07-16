import { Suspense } from 'react'
import { PrivateRequestSlot } from './PrivateRequestSlot'

export default function StaticShellPrivateSlotPage() {
  return (
    <section className="page-section" data-testid="static-shell-private-slot-shell">
      <header className="page-section__header">
        <h1>Static Shell</h1>
      </header>
      <Suspense fallback={<div data-testid="private-slot-fallback" />}>
        <PrivateRequestSlot />
      </Suspense>
    </section>
  )
}
