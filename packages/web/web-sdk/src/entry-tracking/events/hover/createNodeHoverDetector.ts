import type { CoreStateful } from '@contentful/optimization-core'
import type { NodeInteractionDetector } from '../../NodeInteractionDetector'
import { resolveNodeDataset } from '../../resolveNodeViewArgs'
import type {
  ElementHoverCallbackInfo,
  ElementHoverObserverOptions,
} from './element-hover-observer-support'
import ElementHoverObserver from './ElementHoverObserver'

/**
 * Minimal core shape required by {@link createNodeHoverDetector}.
 *
 * @public
 */
export type NodeHoverTrackingCore = Pick<CoreStateful, 'trackHover'>

/**
 * Create an {@link ElementHoverObserver}-backed detector that fires
 * `trackHover` once a `data-ctfl-node-id` element has been hovered long enough
 * to satisfy the dwell threshold.
 *
 * @internal
 */
export function createNodeHoverDetector(
  core: NodeHoverTrackingCore,
  options?: ElementHoverObserverOptions,
): NodeInteractionDetector {
  const callback = async (element: Element, info: ElementHoverCallbackInfo): Promise<void> => {
    const resolved = resolveNodeDataset(element)
    if (!resolved) return

    await core.trackHover({
      componentId: resolved.entityId,
      experienceId: resolved.parentExperienceId ?? resolved.optimizationId,
      variantIndex: resolved.variantIndex,
      hoverId: info.hoverId,
      hoverDurationMs: Math.max(0, Math.round(info.totalHoverMs)),
    })
  }

  const observer = new ElementHoverObserver(callback, options)

  return {
    observe: (element): void => {
      observer.observe(element)
    },
    unobserve: (element): void => {
      observer.unobserve(element)
    },
    disconnect: (): void => {
      observer.disconnect()
    },
  }
}
