/**
 * Optimization Core bridge support.
 *
 * @packageDocumentation
 */

import type { OptimizationData } from '@contentful/optimization-api-client/api-schemas'
import {
  CORE_BRIDGE_CAPABILITIES_SYMBOL,
  getCoreBridgeCapabilities,
  type CoreBridgeCapabilities,
  type CoreBridgeHost,
  type PreviewPanelBridge,
} from './coreBridgeCapabilities'

export { CORE_BRIDGE_CAPABILITIES_SYMBOL }
export type { CoreBridgeCapabilities, CoreBridgeHost, PreviewPanelBridge }

function getRequiredBridge(sdk: unknown): CoreBridgeCapabilities {
  const bridge = getCoreBridgeCapabilities(sdk)

  if (!bridge) {
    throw new Error('Contentful Optimization SDK instance does not expose bridge support.')
  }

  return bridge
}

export async function hydrateOptimizationData(
  sdk: unknown,
  data: OptimizationData | undefined,
): Promise<void> {
  if (!data) return

  await getRequiredBridge(sdk).hydrateOptimizationData(data)
}

export function getPreviewPanelBridge(sdk: unknown): PreviewPanelBridge {
  return getRequiredBridge(sdk).getPreviewPanelBridge()
}
