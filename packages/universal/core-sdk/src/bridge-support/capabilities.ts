import type {
  ChangeArray,
  OptimizationData,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import type { Signal } from '@preact/signals-core'
import type { LifecycleInterceptors } from '../CoreBase'
import { signals } from '../signals'
import { applyOptimizationDataToSignals } from '../state/applyOptimizationDataToSignals'

export const CORE_BRIDGE_CAPABILITIES_SYMBOL = Symbol.for(
  'ctfl.optimization.internal.bridgeSupport',
)

export interface PreviewPanelBridge {
  readonly changes: Signal<ChangeArray | undefined>
  readonly consent: Signal<boolean | undefined>
  readonly previewPanelAttached: Signal<boolean>
  readonly previewPanelOpen: Signal<boolean>
  readonly profile: Signal<Profile | undefined>
  readonly selectedOptimizations: Signal<SelectedOptimizationArray | undefined>
  readonly stateInterceptors: Pick<LifecycleInterceptors['state'], 'add' | 'remove'>
}

export interface CoreBridgeCapabilities {
  readonly getPreviewPanelBridge: () => PreviewPanelBridge
  readonly hydrateOptimizationData: (data: OptimizationData) => Promise<void>
}

export interface CoreBridgeHost {
  readonly [CORE_BRIDGE_CAPABILITIES_SYMBOL]?: CoreBridgeCapabilities
}

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

export function getCoreBridgeCapabilities(sdk: unknown): CoreBridgeCapabilities | undefined {
  if (sdk === null || (typeof sdk !== 'object' && typeof sdk !== 'function')) return undefined
  if (!hasCoreBridgeCapabilities(sdk)) return undefined

  return sdk[CORE_BRIDGE_CAPABILITIES_SYMBOL]
}

function hasCoreBridgeCapabilities(host: object): host is CoreBridgeHost {
  return CORE_BRIDGE_CAPABILITIES_SYMBOL in host
}
