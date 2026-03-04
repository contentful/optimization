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
import ElementExistenceObserver from './registry/ElementExistenceObserver'
import { EntryElementRegistry } from './registry/EntryElementRegistry'
import {
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
  resolveAutoTrackEntryInteractionOptions,
} from './resolveAutoTrackEntryInteractionOptions'

const ENTRY_INTERACTIONS: EntryInteraction[] = ['clicks', 'views', 'hovers']

type EntryInteractionRuntimeCore = EntryClickTrackingCore &
  EntryViewTrackingCore &
  EntryHoverTrackingCore

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

/**
 * Runtime coordinator for tracked entry interactions (clicks, views, and hovers).
 *
 * @remarks
 * Owns shared registry/observer dependencies and exposes an imperative
 * tracking API that can enable, disable, observe, and unobserve interactions.
 *
 * @internal
 */
export class EntryInteractionRuntime {
  private readonly entryInteractionDetectors: EntryInteractionDetectorMap
  private readonly entryElementRegistry: EntryElementRegistry
  private readonly entryExistenceObserver: ElementExistenceObserver
  private readonly cleanupRegistrySubscriptions: Record<
    EntryInteraction,
    (() => void) | undefined
  > = {
    clicks: undefined,
    views: undefined,
    hovers: undefined,
  }

  private readonly autoTrack: Record<EntryInteraction, boolean>
  public readonly tracking: EntryInteractionApi
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
  private autoTrackingAllowed = true

  public constructor(
    core: EntryInteractionRuntimeCore,
    autoTrackEntryInteraction?: AutoTrackEntryInteractionOptions,
  ) {
    this.entryExistenceObserver = new ElementExistenceObserver()
    this.entryElementRegistry = new EntryElementRegistry(this.entryExistenceObserver)

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
    this.entryElementRegistry.disconnect()
    this.entryExistenceObserver.disconnect()
  }

  public syncAutoTrackedEntryInteractions(hasConsent: boolean): void {
    this.autoTrackingAllowed = hasConsent
    this.reconcileAllInteractions()
  }

  private reconcileAllInteractions(): void {
    ENTRY_INTERACTIONS.forEach((interaction) => {
      this.reconcileInteraction(interaction)
    })
  }

  private reconcileInteraction(interaction: EntryInteraction, restart = false): void {
    const shouldAutoTrack = this.autoTrack[interaction] && this.autoTrackingAllowed
    const shouldRun = shouldAutoTrack || this.hasEnabledElementOverrides(interaction)

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

    this.cleanupRegistrySubscriptions[interaction] = this.entryElementRegistry.subscribe({
      onAdded: detector.onEntryAdded,
      onRemoved: detector.onEntryRemoved,
      onError: detector.onError,
    })

    this.isInteractionRunning[interaction] = true
    this.isAutoTrackingEnabled[interaction] = autoTrackingEnabled
  }

  private stopEntryInteraction(interaction: EntryInteraction): void {
    this.cleanupRegistrySubscriptions[interaction]?.()
    this.cleanupRegistrySubscriptions[interaction] = undefined

    this.getDetector(interaction).stop()
    this.isInteractionRunning[interaction] = false
    this.isAutoTrackingEnabled[interaction] = false
  }

  private stopAllEntryInteractions(): void {
    ENTRY_INTERACTIONS.forEach((interaction) => {
      this.stopEntryInteraction(interaction)
    })
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
