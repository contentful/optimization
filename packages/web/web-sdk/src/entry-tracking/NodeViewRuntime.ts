import { NODE_VIEW_SELECTOR } from '../constants'
import {
  createNodeViewDetector,
  type NodeViewDetector,
  type NodeViewTrackingCore,
} from './events/view/createNodeViewDetector'
import type { ElementViewObserverOptions } from './events/view/element-view-observer-support'
import ElementExistenceObserver from './registry/ElementExistenceObserver'

/**
 * Runtime that manages automatic `exo_node_view` tracking for all DOM elements
 * carrying `data-ctfl-node-id` attributes.
 *
 * @remarks
 * Attaches a `MutationObserver` (via {@link ElementExistenceObserver}) to detect
 * when node-view elements enter or leave the DOM, and delegates viewport dwell
 * tracking to a {@link NodeViewDetector}.
 *
 * Call {@link NodeViewRuntime.start} to activate and {@link NodeViewRuntime.destroy}
 * to release all resources.
 *
 * @internal
 */
export class NodeViewRuntime {
  private readonly core: NodeViewTrackingCore
  private readonly observerOptions: ElementViewObserverOptions | undefined
  private detector: NodeViewDetector | undefined
  private existenceObserver: ElementExistenceObserver | undefined
  private cleanupExistence: (() => void) | undefined

  public constructor(core: NodeViewTrackingCore, options?: ElementViewObserverOptions) {
    this.core = core
    this.observerOptions = options
  }

  public start(): void {
    if (this.detector) return

    this.detector = createNodeViewDetector(this.core, this.observerOptions)

    this.existenceObserver = new ElementExistenceObserver()

    this.cleanupExistence = this.existenceObserver.subscribe({
      onAdded: (elements): void => {
        for (const element of elements) {
          if (element.matches(NODE_VIEW_SELECTOR)) {
            this.detector?.observe(element)
          }
        }
      },
      onRemoved: (elements): void => {
        for (const element of elements) {
          if (element.matches(NODE_VIEW_SELECTOR)) {
            this.detector?.unobserve(element)
          }
        }
      },
    })

    if (typeof document !== 'undefined') {
      document.querySelectorAll(NODE_VIEW_SELECTOR).forEach((element) => {
        this.detector?.observe(element)
      })
    }
  }

  public stop(): void {
    this.cleanupExistence?.()
    this.cleanupExistence = undefined

    this.existenceObserver?.disconnect()
    this.existenceObserver = undefined

    this.detector?.disconnect()
    this.detector = undefined
  }

  public destroy(): void {
    this.stop()
  }
}
