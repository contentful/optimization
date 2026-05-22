import type { JSX } from 'react'
import { NodeViewDebugPanel } from '../components/NodeViewDebugPanel'
import { NodeViewTrackingSection } from '../sections/NodeViewTrackingSection'

export function ExoPage(): JSX.Element {
  return (
    <section data-testid="exo-page" style={{ display: 'grid', gap: 16 }}>
      <h2>ExO Node View</h2>
      <NodeViewTrackingSection />
      <NodeViewDebugPanel />
    </section>
  )
}
