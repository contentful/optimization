import type { CoreStateful } from '@contentful/optimization-core'
import { resolveNodeViewArgs } from '../../resolveNodeViewArgs'
import type {
  ElementViewCallbackInfo,
  ElementViewObserverOptions,
} from './element-view-observer-support'
import ElementViewObserver from './ElementViewObserver'

/**
 * Minimal core shape required by {@link createNodeViewDetector}.
 *
 * @public
 */
export type NodeViewTrackingCore = Pick<CoreStateful, 'trackNodeView'>

/**
 * Detector returned by {@link createNodeViewDetector}.
 *
 * @internal
 */
export interface NodeViewDetector {
  /** Begin observing an element for viewport dwell. */
  observe: (element: Element) => void
  /** Stop observing an element. */
  unobserve: (element: Element) => void
  /** Disconnect and release all resources. */
  disconnect: () => void
}

/**
 * Create an {@link ElementViewObserver}-backed detector that fires
 * `trackNodeView` once a `data-ctfl-node-id` element has dwelled in the
 * viewport.
 *
 * @param core - Object exposing {@link NodeViewTrackingCore.trackNodeView}.
 * @param options - Optional {@link ElementViewObserver} configuration.
 * @returns A {@link NodeViewDetector} that manages element observation.
 *
 * @internal
 */
export function createNodeViewDetector(
  core: NodeViewTrackingCore,
  options?: ElementViewObserverOptions,
): NodeViewDetector {
  const callback = async (element: Element, info: ElementViewCallbackInfo): Promise<void> => {
    const args = resolveNodeViewArgs(element, info)
    if (args !== undefined) {
      await core.trackNodeView(args)
    }
  }

  const observer = new ElementViewObserver(callback, options)

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
