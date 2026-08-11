import type {
  ChangeArray,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import type { Signal } from '@preact/signals-core'
import type { LifecycleInterceptors } from '../CoreBase'

export const CORE_BRIDGE_CAPABILITIES_SYMBOL = Symbol.for(
  'ctfl.optimization.internal.bridgeSupport',
)

/**
 * Mutable state bridge exposed only to first-party preview-panel integrations.
 *
 * @remarks
 * Preview needs controlled writable-signal access to synthesize immediate local overrides. This is
 * public so separately published first-party preview packages can compose it, but it is not a
 * supported general-purpose downstream SDK integration surface.
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
 * Preview-only bridge capabilities exposed by compatible SDK instances.
 *
 * @remarks
 * General inter-SDK coordination belongs in purpose-specific public APIs that preserve Core
 * invariants without exposing writable signal handles. This public type exists for separately
 * published first-party preview packages, not as a custom-integration contract.
 *
 * @public
 */
export interface CoreBridgeCapabilities {
  readonly getPreviewPanelBridge: () => PreviewPanelBridge
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
