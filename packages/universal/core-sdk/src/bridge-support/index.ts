/**
 * Optimization Core bridge support.
 *
 * @packageDocumentation
 */

import type { OptimizationData } from '@contentful/optimization-api-client/api-schemas'
import {
  getCoreBridgeCapabilities,
  type CoreBridgeCapabilities,
  type PreviewPanelBridge,
} from './coreBridgeCapabilities'

export type { CoreBridgeCapabilities, PreviewPanelBridge }

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
