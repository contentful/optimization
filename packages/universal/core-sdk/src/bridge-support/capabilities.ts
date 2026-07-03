import type { LifecycleInterceptors } from '../CoreBase'
import { signals } from '../signals'
import { applyOptimizationDataToSignals } from '../state/applyOptimizationDataToSignals'
import {
  CORE_BRIDGE_CAPABILITIES_SYMBOL,
  type CoreBridgeCapabilities,
} from './coreBridgeCapabilities'

export {
  CORE_BRIDGE_CAPABILITIES_SYMBOL,
  getCoreBridgeCapabilities,
  type CoreBridgeCapabilities,
  type CoreBridgeHost,
  type PreviewPanelBridge,
} from './coreBridgeCapabilities'

export function installCoreBridgeCapabilities(
  host: object,
  stateInterceptors: LifecycleInterceptors['state'],
): void {
  const capabilities: CoreBridgeCapabilities = {
    getPreviewPanelBridge: () => ({
      changes: signals.changes,
      consent: signals.consent,
      previewPanelAttached: signals.previewPanelAttached,
      previewPanelOpen: signals.previewPanelOpen,
      profile: signals.profile,
      selectedOptimizations: signals.selectedOptimizations,
      stateInterceptors,
    }),
    hydrateOptimizationData: async (data) => {
      await applyOptimizationDataToSignals(data, stateInterceptors)
    },
  }

  Object.defineProperty(host, CORE_BRIDGE_CAPABILITIES_SYMBOL, {
    configurable: false,
    enumerable: false,
    value: capabilities,
    writable: false,
  })
}
