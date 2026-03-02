import {
  createEntryClickDetector,
  type EntryClickTrackingCore,
} from './click/createEntryClickDetector'
import type { EntryInteractionDetector } from './EntryInteractionDetector'
import ElementExistenceObserver from './registry/ElementExistenceObserver'
import { EntryElementRegistry } from './registry/EntryElementRegistry'
import {
  type AutoTrackEntryInteractionOptions,
  type EntryClickInteractionElementOptions,
  type EntryElementInteraction,
  type EntryInteraction,
  type EntryInteractionApi,
  type EntryViewInteractionElementOptions,
  type EntryViewInteractionStartOptions,
  resolveAutoTrackEntryInteractionOptions,
} from './resolveAutoTrackEntryInteractionOptions'
import { createEntryViewDetector, type EntryViewTrackingCore } from './view/createEntryViewDetector'

type EntryInteractionRuntimeCore = EntryClickTrackingCore & EntryViewTrackingCore

interface EntryInteractionElementOverride<TOptions> {
  enabled: boolean
  options?: TOptions
}

interface EntryInteractionElementOverrideMap {
  clicks: Map<Element, EntryInteractionElementOverride<EntryClickInteractionElementOptions>>
  views: Map<Element, EntryInteractionElementOverride<EntryViewInteractionElementOptions>>
}

interface EntryInteractionDetectorMap {
  clicks: EntryInteractionDetector<undefined, EntryClickInteractionElementOptions>
  views: EntryInteractionDetector<
    EntryViewInteractionStartOptions | undefined,
    EntryViewInteractionElementOptions
  >
}

/**
 * Runtime coordinator for tracked entry interactions (clicks and views).
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
  }

  private readonly autoTrack: Record<EntryInteraction, boolean>
  public readonly tracking: EntryInteractionApi
  private readonly elementOverrides: EntryInteractionElementOverrideMap = {
    clicks: new Map(),
    views: new Map(),
  }
  private viewStartOptions: EntryViewInteractionStartOptions | undefined
  private readonly isInteractionRunning: Record<EntryInteraction, boolean> = {
    clicks: false,
    views: false,
  }
  private readonly isAutoTrackingEnabled: Record<EntryInteraction, boolean> = {
    clicks: false,
    views: false,
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
    }
    this.autoTrack = resolveAutoTrackEntryInteractionOptions(autoTrackEntryInteraction)

    this.tracking = {
      enable: (interaction, options): void => {
        this.autoTrack[interaction] = true
        if (interaction === 'views') {
          this.viewStartOptions = options
        }
        this.reconcileInteraction(interaction, true)
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
    this.reconcileInteraction('clicks')
    this.reconcileInteraction('views')
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
    if (interaction === 'views') {
      this.entryInteractionDetectors.views.start(this.viewStartOptions)
    } else {
      this.entryInteractionDetectors.clicks.start()
    }

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
    this.stopEntryInteraction('clicks')
    this.stopEntryInteraction('views')
  }

  private setElementOverride<TInteraction extends EntryElementInteraction>(
    interaction: TInteraction,
    element: Element,
    override: EntryInteractionElementOverride<
      TInteraction extends 'clicks'
        ? EntryClickInteractionElementOptions
        : EntryViewInteractionElementOptions
    >,
  ): void {
    const overrides =
      interaction === 'clicks' ? this.elementOverrides.clicks : this.elementOverrides.views

    overrides.set(element, override)
    this.reconcileInteraction(interaction)
  }

  private clearElement(interaction: EntryElementInteraction, element: Element): void {
    const overrides =
      interaction === 'clicks' ? this.elementOverrides.clicks : this.elementOverrides.views

    if (!overrides.delete(element)) return

    if (this.isInteractionRunning[interaction]) {
      this.entryInteractionDetectors[interaction].clearElement?.(element)
    }

    this.reconcileInteraction(interaction)
  }

  private clearAllElementOverrides(): void {
    this.elementOverrides.clicks.clear()
    this.elementOverrides.views.clear()
  }

  private hasEnabledElementOverrides(interaction: EntryElementInteraction): boolean {
    const overrides =
      interaction === 'clicks' ? this.elementOverrides.clicks : this.elementOverrides.views

    for (const override of overrides.values()) {
      if (override.enabled) return true
    }

    return false
  }

  private applyElementOverrides(interaction: EntryElementInteraction): void {
    const detector = this.getDetector(interaction)
    const overrides =
      interaction === 'clicks' ? this.elementOverrides.clicks : this.elementOverrides.views

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
}
