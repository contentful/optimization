import { HAS_MUTATION_OBSERVER, NODE_ID_ATTRIBUTE, NODE_SELECTOR } from '../constants'
import {
  createNodeClickDetector,
  type NodeClickTrackingCore,
} from './events/click/createNodeClickDetector'
import {
  createNodeHoverDetector,
  type NodeHoverTrackingCore,
} from './events/hover/createNodeHoverDetector'
import type { ElementHoverObserverOptions } from './events/hover/element-hover-observer-support'
import {
  createNodeViewDetector,
  type NodeViewTrackingCore,
} from './events/view/createNodeViewDetector'
import type { ElementViewObserverOptions } from './events/view/element-view-observer-support'
import type { NodeInteractionDetector } from './NodeInteractionDetector'

/**
 * Node-keyed interaction the runtime coordinates.
 *
 * @public
 */
export type NodeInteraction = 'views' | 'clicks' | 'hovers'

const NODE_INTERACTIONS: readonly NodeInteraction[] = ['clicks', 'views', 'hovers']

const NODE_INTERACTION_CONSENT_METHODS: Readonly<Record<NodeInteraction, string>> = {
  views: 'trackNodeView',
  clicks: 'trackClick',
  hovers: 'trackHover',
}

/**
 * Core shape required by {@link NodeInteractionRuntime}.
 *
 * @public
 */
export type NodeInteractionRuntimeCore = NodeViewTrackingCore &
  NodeClickTrackingCore &
  NodeHoverTrackingCore & {
    hasConsent: (name: string) => boolean
  }

/**
 * Options forwarded to individual node-interaction detectors.
 *
 * @public
 */
export interface NodeInteractionRuntimeOptions {
  view?: ElementViewObserverOptions
  hover?: ElementHoverObserverOptions
}

/**
 * Imperative API mirroring `EntryInteractionApi` but keyed on
 * `data-ctfl-node-id` elements.
 *
 * @public
 */
export interface OptimizationTrackingApi {
  enable: (interaction: NodeInteraction) => void
  disable: (interaction: NodeInteraction) => void
  enableElement: (interaction: NodeInteraction, element: Element) => void
  disableElement: (interaction: NodeInteraction, element: Element) => void
  clearElement: (interaction: NodeInteraction, element: Element) => void
}

const isNode = (value: unknown): value is Node =>
  typeof Node !== 'undefined' && value instanceof Node

const isElement = (node: Node): node is Element =>
  typeof Element !== 'undefined' && node instanceof Element

const isDocumentFragment = (node: Node): node is DocumentFragment =>
  typeof DocumentFragment !== 'undefined' && node instanceof DocumentFragment

function collectElements(
  nodes: ReadonlySet<Node>,
  requireConnected: boolean,
  target: Set<Element>,
): void {
  nodes.forEach((node) => {
    if (isElement(node)) {
      if (!requireConnected || node.isConnected) target.add(node)
      node.querySelectorAll('*').forEach((element) => {
        if (!requireConnected || element.isConnected) target.add(element)
      })
      return
    }

    if (!isDocumentFragment(node)) return

    node.querySelectorAll('*').forEach((element) => {
      if (!requireConnected || element.isConnected) target.add(element)
    })
  })
}

function collectNodeAttributeMutation(
  record: MutationRecord,
  addedNodes: Set<Node>,
  removedNodes: Set<Node>,
): boolean {
  if (record.type !== 'attributes' || record.attributeName !== NODE_ID_ATTRIBUTE) return false

  if (isNode(record.target)) {
    removedNodes.add(record.target)
    addedNodes.add(record.target)
  }

  return true
}

function collectChildListMutation(
  record: MutationRecord,
  addedNodes: Set<Node>,
  removedNodes: Set<Node>,
): void {
  record.addedNodes.forEach((node) => {
    if (removedNodes.delete(node)) return
    addedNodes.add(node)
  })

  record.removedNodes.forEach((node) => {
    if (addedNodes.delete(node)) return
    removedNodes.add(node)
  })
}

interface ElementOverride {
  enabled: boolean
}

type OverrideMap = Record<NodeInteraction, Map<Element, ElementOverride>>

type DetectorMap = Record<NodeInteraction, NodeInteractionDetector>

/**
 * Runtime coordinator for node-keyed interactions (views, clicks, hovers)
 * used by `@contentful/optimization-react-web/experiences-adapter`.
 *
 * @remarks
 * Discovers `data-ctfl-node-id` elements via a `MutationObserver`, and delegates
 * observation to per-interaction detectors. Interactions activate only after
 * global consent for the underlying event type is granted, matching the pattern
 * established by {@link EntryInteractionRuntime}.
 *
 * @internal
 */
export class NodeInteractionRuntime {
  private readonly core: NodeInteractionRuntimeCore
  private readonly detectors: DetectorMap
  private readonly nodeElements = new Set<Element>()
  private readonly autoTrack: Record<NodeInteraction, boolean> = {
    views: false,
    clicks: false,
    hovers: false,
  }
  private readonly elementOverrides: OverrideMap = {
    views: new Map(),
    clicks: new Map(),
    hovers: new Map(),
  }
  private readonly isInteractionRunning: Record<NodeInteraction, boolean> = {
    views: false,
    clicks: false,
    hovers: false,
  }
  private nodeElementObserver: MutationObserver | undefined = undefined

  public readonly tracking: OptimizationTrackingApi

  public constructor(
    core: NodeInteractionRuntimeCore,
    options: NodeInteractionRuntimeOptions = {},
  ) {
    this.core = core
    this.detectors = {
      views: createNodeViewDetector(core, options.view),
      clicks: createNodeClickDetector(core),
      hovers: createNodeHoverDetector(core, options.hover),
    }

    this.tracking = {
      enable: (interaction): void => {
        this.autoTrack[interaction] = true
        this.reconcileInteraction(interaction)
      },
      disable: (interaction): void => {
        this.autoTrack[interaction] = false
        this.reconcileInteraction(interaction)
      },
      enableElement: (interaction, element): void => {
        this.elementOverrides[interaction].set(element, { enabled: true })
        this.reconcileInteraction(interaction)
      },
      disableElement: (interaction, element): void => {
        this.elementOverrides[interaction].set(element, { enabled: false })
        this.reconcileInteraction(interaction)
      },
      clearElement: (interaction, element): void => {
        if (!this.elementOverrides[interaction].delete(element)) return
        if (this.isInteractionRunning[interaction]) {
          this.detectors[interaction].unobserve(element)
        }
        this.reconcileInteraction(interaction)
      },
    }
  }

  public reset(): void {
    NODE_INTERACTIONS.forEach((interaction) => {
      this.stopInteraction(interaction)
      this.elementOverrides[interaction].clear()
    })
  }

  public destroy(): void {
    this.reset()
    this.stopNodeElementObservation()
    NODE_INTERACTIONS.forEach((interaction) => {
      this.detectors[interaction].disconnect()
    })
  }

  public syncAutoTrackedNodeInteractions(): void {
    NODE_INTERACTIONS.forEach((interaction) => {
      this.reconcileInteraction(interaction)
    })
  }

  private reconcileInteraction(interaction: NodeInteraction): void {
    const shouldRun =
      this.isInteractionAllowed(interaction) &&
      (this.isAutoTrackingEnabled(interaction) || this.hasEnabledElementOverrides(interaction))

    if (!shouldRun) {
      if (this.isInteractionRunning[interaction]) this.stopInteraction(interaction)
      return
    }

    if (!this.isInteractionRunning[interaction]) this.startInteraction(interaction)
    this.applyElementObservation(interaction)
  }

  private isAutoTrackingEnabled(interaction: NodeInteraction): boolean {
    if (interaction === 'views') return this.autoTrack.views
    if (interaction === 'clicks') return this.autoTrack.clicks
    return this.autoTrack.hovers
  }

  private startInteraction(interaction: NodeInteraction): void {
    this.ensureNodeElementObservation()
    this.seedInitialNodeElements()
    this.isInteractionRunning[interaction] = true
  }

  private stopInteraction(interaction: NodeInteraction): void {
    if (!this.isInteractionRunning[interaction]) return

    this.nodeElements.forEach((element) => {
      this.detectors[interaction].unobserve(element)
    })
    this.elementOverrides[interaction].forEach((_, element) => {
      this.detectors[interaction].unobserve(element)
    })
    this.isInteractionRunning[interaction] = false

    this.maybeStopNodeElementObservation()
  }

  private applyElementObservation(interaction: NodeInteraction): void {
    if (!this.isInteractionRunning[interaction]) return

    const detector = this.getDetector(interaction)
    const overrides = this.getElementOverrides(interaction)
    const autoTrack = this.isAutoTrackingEnabled(interaction)

    this.nodeElements.forEach((element) => {
      const override = overrides.get(element)
      if (override?.enabled === false) {
        detector.unobserve(element)
        return
      }
      if (override?.enabled === true || autoTrack) {
        detector.observe(element)
      } else {
        detector.unobserve(element)
      }
    })

    overrides.forEach((override, element) => {
      if (this.nodeElements.has(element)) return
      if (override.enabled) detector.observe(element)
      else detector.unobserve(element)
    })
  }

  private getDetector(interaction: NodeInteraction): NodeInteractionDetector {
    return this.detectors[interaction]
  }

  private getElementOverrides(interaction: NodeInteraction): Map<Element, ElementOverride> {
    return this.elementOverrides[interaction]
  }

  private hasEnabledElementOverrides(interaction: NodeInteraction): boolean {
    for (const override of this.elementOverrides[interaction].values()) {
      if (override.enabled) return true
    }
    return false
  }

  private isInteractionAllowed(interaction: NodeInteraction): boolean {
    return this.core.hasConsent(NODE_INTERACTION_CONSENT_METHODS[interaction])
  }

  private ensureNodeElementObservation(): void {
    if (this.nodeElementObserver) return
    if (!HAS_MUTATION_OBSERVER || typeof document === 'undefined') return

    this.nodeElementObserver = new MutationObserver((records) => {
      this.processNodeElementRecords(records)
    })

    this.nodeElementObserver.observe(document, {
      attributeFilter: [NODE_ID_ATTRIBUTE],
      attributes: true,
      childList: true,
      subtree: true,
    })
  }

  private seedInitialNodeElements(): void {
    if (typeof document === 'undefined') return

    document.querySelectorAll(NODE_SELECTOR).forEach((element) => {
      if (this.nodeElements.has(element)) return

      this.nodeElements.add(element)
      this.notifyNodeElementAdded(element)
    })
  }

  private processNodeElementRecords(records: readonly MutationRecord[]): void {
    if (records.length === 0) return

    const addedNodes = new Set<Node>()
    const removedNodes = new Set<Node>()

    records.forEach((record) => {
      if (collectNodeAttributeMutation(record, addedNodes, removedNodes)) return
      collectChildListMutation(record, addedNodes, removedNodes)
    })

    if (addedNodes.size === 0 && removedNodes.size === 0) return

    const removedElements = new Set<Element>()
    const addedElements = new Set<Element>()

    collectElements(removedNodes, false, removedElements)
    collectElements(addedNodes, true, addedElements)

    this.removeNodeElements(removedElements)
    this.addNodeElements(addedElements)
  }

  private addNodeElements(elements: Iterable<Element>): void {
    for (const element of elements) {
      if (!element.matches(NODE_SELECTOR)) continue
      if (this.nodeElements.has(element)) continue

      this.nodeElements.add(element)
      this.notifyNodeElementAdded(element)
    }
  }

  private removeNodeElements(elements: Iterable<Element>): void {
    for (const element of elements) {
      if (!this.nodeElements.delete(element)) continue
      this.notifyNodeElementRemoved(element)
    }
  }

  private notifyNodeElementAdded(element: Element): void {
    NODE_INTERACTIONS.forEach((interaction) => {
      if (!this.isInteractionRunning[interaction]) return
      const override = this.elementOverrides[interaction].get(element)
      if (override?.enabled === false) return
      if (override?.enabled === true || this.autoTrack[interaction]) {
        this.detectors[interaction].observe(element)
      }
    })
  }

  private notifyNodeElementRemoved(element: Element): void {
    NODE_INTERACTIONS.forEach((interaction) => {
      if (!this.isInteractionRunning[interaction]) return
      this.detectors[interaction].unobserve(element)
    })
  }

  private maybeStopNodeElementObservation(): void {
    if (NODE_INTERACTIONS.some((interaction) => this.isInteractionRunning[interaction])) return
    this.stopNodeElementObservation()
  }

  private stopNodeElementObservation(): void {
    this.nodeElementObserver?.disconnect()
    this.nodeElementObserver = undefined
    this.nodeElements.clear()
  }
}
