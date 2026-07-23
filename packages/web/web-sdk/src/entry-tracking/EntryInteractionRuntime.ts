import { ENTRY_ID_ATTRIBUTE, ENTRY_SELECTOR, HAS_MUTATION_OBSERVER } from '../constants'
import { safeCall } from '../lib/safeCall'
import type { EntryInteractionDetector } from './EntryInteractionDetector'
import {
  createEntryClickDetector,
  type EntryClickTrackingCore,
} from './events/click/createEntryClickDetector'
import {
  createEntryHoverDetector,
  type EntryHoverTrackingCore,
} from './events/hover/createEntryHoverDetector'
import {
  createEntryViewDetector,
  type EntryViewTrackingCore,
} from './events/view/createEntryViewDetector'
import {
  resolveAutoTrackEntryInteractionOptions,
  type AutoTrackEntryInteractionOptions,
  type EntryClickInteractionElementOptions,
  type EntryElementInteraction,
  type EntryHoverInteractionElementOptions,
  type EntryHoverInteractionStartOptions,
  type EntryInteraction,
  type EntryInteractionApi,
  type EntryInteractionStartOptions,
  type EntryViewInteractionElementOptions,
  type EntryViewInteractionStartOptions,
} from './resolveAutoTrackEntryInteractionOptions'
import { isEntryElement, type EntryElement } from './resolveTrackingPayload'

const ENTRY_INTERACTIONS: EntryInteraction[] = ['clicks', 'views', 'hovers']

type EntryInteractionRuntimeCore = EntryClickTrackingCore &
  EntryViewTrackingCore &
  EntryHoverTrackingCore & {
    hasConsent: (name: string) => boolean
  }

const ENTRY_INTERACTION_CONSENT_METHODS: Readonly<Record<EntryInteraction, string>> = {
  clicks: 'trackClick',
  views: 'trackView',
  hovers: 'trackHover',
}

interface EntryInteractionElementOverride<TOptions> {
  enabled: boolean
  options?: TOptions
}

interface EntryInteractionElementOverrideMap {
  clicks: Map<Element, EntryInteractionElementOverride<EntryClickInteractionElementOptions>>
  views: Map<Element, EntryInteractionElementOverride<EntryViewInteractionElementOptions>>
  hovers: Map<Element, EntryInteractionElementOverride<EntryHoverInteractionElementOptions>>
}

interface EntryInteractionDetectorMap {
  clicks: EntryInteractionDetector<undefined, EntryClickInteractionElementOptions>
  views: EntryInteractionDetector<
    EntryViewInteractionStartOptions | undefined,
    EntryViewInteractionElementOptions
  >
  hovers: EntryInteractionDetector<
    EntryHoverInteractionStartOptions | undefined,
    EntryHoverInteractionElementOptions
  >
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

function collectEntryAttributeMutation(
  record: MutationRecord,
  addedNodes: Set<Node>,
  removedNodes: Set<Node>,
): boolean {
  if (record.type !== 'attributes' || record.attributeName !== ENTRY_ID_ATTRIBUTE) return false

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

function hasSameBaselineTrackedAncestor(element: EntryElement): boolean {
  const {
    dataset: { ctflBaselineId: baselineId },
  } = element
  if (!baselineId) return false

  let { parentElement: ancestor } = element
  while (ancestor) {
    const { parentElement } = ancestor
    if (isEntryElement(ancestor)) {
      const {
        dataset: { ctflBaselineId },
      } = ancestor
      if (ctflBaselineId === baselineId) return true
    }
    ancestor = parentElement
  }

  return false
}

/**
 * Runtime coordinator for tracked entry interactions (clicks, views, and hovers).
 *
 * @remarks
 * Exposes an imperative tracking API that can enable, disable, observe, and unobserve interactions.
 * Automatic view and hover timers start only after Core allows the underlying
 * event type by consent or `allowedEventTypes`.
 *
 * @internal
 */
export class EntryInteractionRuntime {
  private readonly core: EntryInteractionRuntimeCore
  private readonly entryInteractionDetectors: EntryInteractionDetectorMap
  private readonly entryElements = new Map<Element, EntryElement>()
  private readonly autoTrack: Record<EntryInteraction, boolean>
  public readonly tracking: EntryInteractionApi
  private entryElementObserver: MutationObserver | undefined
  private readonly elementOverrides: EntryInteractionElementOverrideMap = {
    clicks: new Map(),
    views: new Map(),
    hovers: new Map(),
  }
  private viewStartOptions: EntryViewInteractionStartOptions | undefined
  private hoverStartOptions: EntryHoverInteractionStartOptions | undefined
  private readonly isInteractionRunning: Record<EntryInteraction, boolean> = {
    clicks: false,
    views: false,
    hovers: false,
  }
  private readonly isAutoTrackingEnabled: Record<EntryInteraction, boolean> = {
    clicks: false,
    views: false,
    hovers: false,
  }

  public constructor(
    core: EntryInteractionRuntimeCore,
    autoTrackEntryInteraction?: AutoTrackEntryInteractionOptions,
  ) {
    this.core = core

    this.entryInteractionDetectors = {
      clicks: createEntryClickDetector(core),
      views: createEntryViewDetector(core),
      hovers: createEntryHoverDetector(core),
    }
    this.autoTrack = resolveAutoTrackEntryInteractionOptions(autoTrackEntryInteraction)

    this.tracking = {
      enable: (interaction, options): void => {
        this.enableTracking(interaction, options)
      },
      disable: (interaction): void => {
        this.autoTrack[interaction] = false
        this.reconcileInteraction(interaction)
      },
      enableElement: (interaction, element, options): void => {
        this.setElementOverride(interaction, element, {
          enabled: true,
          options,
        })
      },
      disableElement: (interaction, element): void => {
        this.setElementOverride(interaction, element, { enabled: false })
      },
      clearElement: (interaction, element): void => {
        this.clearElement(interaction, element)
      },
    }
  }

  public reset(): void {
    this.stopAllEntryInteractions()
    this.clearAllElementOverrides()
  }

  public destroy(): void {
    this.stopAllEntryInteractions()
    this.clearAllElementOverrides()
    this.stopEntryElementObservation()
  }

  public syncAutoTrackedEntryInteractions(): void {
    this.reconcileAllInteractions()
  }

  public flushActiveInteractions(): void {
    for (const interaction of ENTRY_INTERACTIONS) {
      if (!this.isInteractionRunning[interaction]) continue
      const { flushActive: fn, onError } = this.getDetector(interaction)
      if (fn) safeCall(fn, onError)
    }
  }

  private reconcileAllInteractions(): void {
    for (const i of ENTRY_INTERACTIONS) this.reconcileInteraction(i)
  }

  private reconcileInteraction(interaction: EntryInteraction, restart = false): void {
    const shouldAutoTrack = this.isAutoTrackingInteractionEnabled(interaction)
    const shouldRun =
      this.isInteractionAllowed(interaction) &&
      (shouldAutoTrack || this.hasEnabledElementOverrides(interaction))

    if (!shouldRun) {
      if (this.isInteractionRunning[interaction]) {
        this.stopEntryInteraction(interaction)
      }
      return
    }

    this.ensureInteractionRunning(interaction, shouldAutoTrack, restart)
    this.applyElementOverrides(interaction)
  }

  private ensureInteractionRunning(
    interaction: EntryInteraction,
    autoTrackingEnabled: boolean,
    restart: boolean,
  ): void {
    const shouldRestart = restart && this.isInteractionRunning[interaction]

    if (!this.isInteractionRunning[interaction] || shouldRestart) {
      if (shouldRestart) this.stopEntryInteraction(interaction)

      this.startEntryInteraction(interaction, autoTrackingEnabled)
      return
    }

    this.syncInteractionAutoTrackingState(interaction, autoTrackingEnabled)
  }

  private syncInteractionAutoTrackingState(
    interaction: EntryInteraction,
    autoTrackingEnabled: boolean,
  ): void {
    if (this.isAutoTrackingEnabled[interaction] === autoTrackingEnabled) return

    this.entryInteractionDetectors[interaction].setAuto?.(autoTrackingEnabled)
    this.isAutoTrackingEnabled[interaction] = autoTrackingEnabled
  }

  private startEntryInteraction(interaction: EntryInteraction, autoTrackingEnabled: boolean): void {
    const detector = this.getDetector(interaction)

    detector.setAuto?.(autoTrackingEnabled)
    if (interaction === 'clicks') this.entryInteractionDetectors.clicks.start()
    else if (interaction === 'views')
      this.entryInteractionDetectors.views.start(this.viewStartOptions)
    else this.entryInteractionDetectors.hovers.start(this.hoverStartOptions)

    this.ensureEntryElementObservation()
    this.seedInitialEntryElements()
    this.isInteractionRunning[interaction] = true
    this.isAutoTrackingEnabled[interaction] = autoTrackingEnabled
    this.entryElements.forEach((entryElement) => {
      this.notifyDetectorAdded(interaction, entryElement)
    })
  }

  private stopEntryInteraction(interaction: EntryInteraction): void {
    this.getDetector(interaction).stop()
    this.isInteractionRunning[interaction] = false
    this.isAutoTrackingEnabled[interaction] = false
    this.maybeStopEntryElementObservation()
  }

  private stopAllEntryInteractions(): void {
    for (const i of ENTRY_INTERACTIONS) this.stopEntryInteraction(i)
  }

  private ensureEntryElementObservation(): void {
    if (this.entryElementObserver) return
    if (!HAS_MUTATION_OBSERVER || typeof document === 'undefined') return

    this.entryElementObserver = new MutationObserver((records) => {
      this.processEntryElementRecords(records)
    })

    this.entryElementObserver.observe(document, {
      attributeFilter: [ENTRY_ID_ATTRIBUTE],
      attributes: true,
      childList: true,
      subtree: true,
    })
  }

  private seedInitialEntryElements(): void {
    if (typeof document === 'undefined') return

    document.querySelectorAll(ENTRY_SELECTOR).forEach((element) => {
      if (
        !isEntryElement(element) ||
        this.entryElements.has(element) ||
        hasSameBaselineTrackedAncestor(element)
      ) {
        return
      }

      this.entryElements.set(element, element)
    })
  }

  private processEntryElementRecords(records: readonly MutationRecord[]): void {
    if (records.length === 0) return

    const addedNodes = new Set<Node>()
    const removedNodes = new Set<Node>()

    records.forEach((record) => {
      if (collectEntryAttributeMutation(record, addedNodes, removedNodes)) return

      collectChildListMutation(record, addedNodes, removedNodes)
    })

    if (addedNodes.size === 0 && removedNodes.size === 0) return

    const removedElements = new Set<Element>()
    const addedElements = new Set<Element>()

    collectElements(removedNodes, false, removedElements)
    collectElements(addedNodes, true, addedElements)
    this.removeEntryElements(removedElements)
    this.addEntryElements(addedElements)
  }

  private addEntryElements(elements: Iterable<Element>): void {
    let added = false

    for (const element of elements) {
      if (
        !isEntryElement(element) ||
        this.entryElements.has(element) ||
        hasSameBaselineTrackedAncestor(element)
      ) {
        continue
      }

      this.entryElements.set(element, element)
      added = true
      this.notifyEntryElementAdded(element)
    }

    if (added) this.removeNestedDuplicateEntryElements()
  }

  private removeEntryElements(elements: Iterable<Element>): void {
    for (const element of elements) {
      const entryElement = this.entryElements.get(element)
      if (!entryElement) continue

      this.entryElements.delete(element)
      this.notifyEntryElementRemoved(entryElement)
    }
  }

  private removeNestedDuplicateEntryElements(): void {
    for (const entryElement of this.entryElements.values()) {
      if (hasSameBaselineTrackedAncestor(entryElement)) this.removeEntryElements([entryElement])
    }
  }

  private notifyEntryElementAdded(entryElement: EntryElement): void {
    ENTRY_INTERACTIONS.forEach((interaction) => {
      if (this.isInteractionRunning[interaction])
        this.notifyDetectorAdded(interaction, entryElement)
    })
  }

  private notifyEntryElementRemoved(entryElement: EntryElement): void {
    ENTRY_INTERACTIONS.forEach((interaction) => {
      if (this.isInteractionRunning[interaction]) {
        this.notifyDetectorRemoved(interaction, entryElement)
      }
    })
  }

  private notifyDetectorAdded(interaction: EntryInteraction, entryElement: EntryElement): void {
    const { onEntryAdded, onError } = this.getDetector(interaction)
    if (!onEntryAdded) return

    safeCall(() => {
      onEntryAdded(entryElement)
    }, onError)
  }

  private notifyDetectorRemoved(interaction: EntryInteraction, entryElement: EntryElement): void {
    const { onEntryRemoved, onError } = this.getDetector(interaction)
    if (!onEntryRemoved) return

    safeCall(() => {
      onEntryRemoved(entryElement)
    }, onError)
  }

  private maybeStopEntryElementObservation(): void {
    if (ENTRY_INTERACTIONS.some((interaction) => this.isInteractionRunning[interaction])) return

    this.stopEntryElementObservation()
  }

  private stopEntryElementObservation(): void {
    this.entryElementObserver?.disconnect()
    this.entryElementObserver = undefined
    this.entryElements.clear()
  }

  private setElementOverride(
    interaction: EntryElementInteraction,
    element: Element,
    override: EntryInteractionElementOverride<
      | EntryClickInteractionElementOptions
      | EntryViewInteractionElementOptions
      | EntryHoverInteractionElementOptions
    >,
  ): void {
    const overrides = this.getElementOverrides(interaction)

    overrides.set(element, override)
    this.reconcileInteraction(interaction)
  }

  private clearElement(interaction: EntryElementInteraction, element: Element): void {
    const overrides = this.getElementOverrides(interaction)

    if (!overrides.delete(element)) return

    if (this.isInteractionRunning[interaction]) {
      this.entryInteractionDetectors[interaction].clearElement?.(element)
    }

    this.reconcileInteraction(interaction)
  }

  private clearAllElementOverrides(): void {
    ENTRY_INTERACTIONS.forEach((interaction) => {
      this.elementOverrides[interaction].clear()
    })
  }

  private hasEnabledElementOverrides(interaction: EntryElementInteraction): boolean {
    const overrides = this.getElementOverrides(interaction)

    for (const override of overrides.values()) {
      if (override.enabled) return true
    }

    return false
  }

  private isAutoTrackingInteractionEnabled(interaction: EntryInteraction): boolean {
    if (interaction === 'clicks') return this.autoTrack.clicks
    if (interaction === 'views') return this.autoTrack.views
    return this.autoTrack.hovers
  }

  private applyElementOverrides(interaction: EntryElementInteraction): void {
    const detector = this.getDetector(interaction)
    const overrides = this.getElementOverrides(interaction)

    overrides.forEach((override, element) => {
      if (override.enabled) {
        detector.enableElement?.(element, override.options)
        return
      }

      detector.disableElement?.(element)
    })
  }

  private getDetector(
    interaction: EntryInteraction,
  ): EntryInteractionDetectorMap[EntryInteraction] {
    return this.entryInteractionDetectors[interaction]
  }

  private getElementOverrides(
    interaction: EntryElementInteraction,
  ): EntryInteractionElementOverrideMap[EntryElementInteraction] {
    return this.elementOverrides[interaction]
  }

  private isInteractionAllowed(interaction: EntryInteraction): boolean {
    return this.core.hasConsent(ENTRY_INTERACTION_CONSENT_METHODS[interaction])
  }

  private enableTracking<TInteraction extends EntryInteraction>(
    interaction: TInteraction,
    options?: EntryInteractionStartOptions<TInteraction>,
  ): void {
    this.autoTrack[interaction] = true

    if (interaction === 'views') {
      this.viewStartOptions = options
    } else if (interaction === 'hovers') {
      this.hoverStartOptions = options
    }

    this.reconcileInteraction(interaction, true)
  }
}
