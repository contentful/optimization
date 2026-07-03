import type {
  ChangeArray,
  OptimizationData,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import type { Signal } from '@preact/signals-core'
import type { LifecycleInterceptors } from '../CoreBase'

export const CORE_BRIDGE_CAPABILITIES_SYMBOL = Symbol.for(
  'ctfl.optimization.internal.bridgeSupport',
)

/**
 * Mutable state bridge exposed to preview-panel integrations.
 *
 * @public
 */
export interface PreviewPanelBridge {
  readonly changes: Signal<ChangeArray | undefined>
  readonly consent: Signal<boolean | undefined>
  readonly previewPanelAttached: Signal<boolean>
  readonly previewPanelOpen: Signal<boolean>
  readonly profile: Signal<Profile | undefined>
  readonly selectedOptimizations: Signal<SelectedOptimizationArray | undefined>
  readonly stateInterceptors: Pick<LifecycleInterceptors['state'], 'add' | 'remove'>
}

/**
 * Internal bridge capabilities exposed by compatible SDK instances.
 *
 * @public
 */
export interface CoreBridgeCapabilities {
  readonly getPreviewPanelBridge: () => PreviewPanelBridge
  readonly hydrateOptimizationData: (data: OptimizationData) => Promise<void>
}

/**
 * Object that may expose core bridge capabilities.
 *
 * @public
 */
export interface CoreBridgeHost {
  readonly [CORE_BRIDGE_CAPABILITIES_SYMBOL]?: CoreBridgeCapabilities
}

/**
 * Read bridge capabilities from a compatible SDK instance.
 *
 * @public
 */
export function getCoreBridgeCapabilities(sdk: unknown): CoreBridgeCapabilities | undefined {
  if (sdk === null || (typeof sdk !== 'object' && typeof sdk !== 'function')) return undefined
  if (!hasCoreBridgeCapabilities(sdk)) return undefined

  return sdk[CORE_BRIDGE_CAPABILITIES_SYMBOL]
}

function hasCoreBridgeCapabilities(host: object): host is CoreBridgeHost {
  return CORE_BRIDGE_CAPABILITIES_SYMBOL in host
}
