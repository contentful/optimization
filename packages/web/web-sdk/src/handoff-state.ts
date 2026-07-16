import type { OptimizationHandoff } from '@contentful/optimization-core'
import { batch, signals } from '@contentful/optimization-core'
import type { PreviewPanelBridge } from '@contentful/optimization-core/bridge-support'

export function hydrateOptimizationSelectionState(
  bridge: PreviewPanelBridge,
  handoff: OptimizationHandoff,
): void {
  const { state } = handoff
  if (state === undefined) return
  const { changes, profile, selectedOptimizations } = state

  batch(() => {
    if (changes !== undefined) bridge.changes.value = changes
    if (selectedOptimizations !== undefined) {
      bridge.selectedOptimizations.value = selectedOptimizations
    }
    if (profile !== undefined) bridge.profile.value = profile

    if (changes !== undefined || selectedOptimizations !== undefined || profile !== undefined) {
      signals.experienceRequestState.value = { status: 'success' }
    }
  })
}
