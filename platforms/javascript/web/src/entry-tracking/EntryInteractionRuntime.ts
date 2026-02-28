import {
  createEntryClickDetector,
  type EntryClickTrackingCore,
} from './click/createEntryClickDetector'
import { EntryInteractionTrackerHost } from './EntryInteractionTrackerHost'
import ElementExistenceObserver from './registry/ElementExistenceObserver'
import { EntryElementRegistry } from './registry/EntryElementRegistry'
import {
  type AutoTrackEntryInteractionOptions,
  type EntryElementInteraction,
  type EntryInteraction,
  type EntryInteractionApi,
  type EntryInteractionElementOptions,
  type EntryInteractionStartOptions,
  type EntryInteractionTrackers,
  resolveAutoTrackEntryInteractionOptions,
} from './resolveAutoTrackEntryInteractionOptions'
import { createEntryViewDetector, type EntryViewTrackingCore } from './view/createEntryViewDetector'

type EntryInteractionRuntimeCore = EntryClickTrackingCore & EntryViewTrackingCore

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
  private readonly entryInteractionTrackers: EntryInteractionTrackers
  private readonly entryElementRegistry: EntryElementRegistry
  private readonly entryExistenceObserver: ElementExistenceObserver

  public readonly autoTrackEntryInteractions: Record<EntryInteraction, boolean>
  public readonly tracking: EntryInteractionApi

  public constructor(
    core: EntryInteractionRuntimeCore,
    autoTrackEntryInteraction?: AutoTrackEntryInteractionOptions,
  ) {
    this.entryExistenceObserver = new ElementExistenceObserver()
    this.entryElementRegistry = new EntryElementRegistry(this.entryExistenceObserver)

    this.entryInteractionTrackers = {
      clicks: new EntryInteractionTrackerHost(
        createEntryClickDetector(core),
        this.entryElementRegistry,
      ),
      views: new EntryInteractionTrackerHost(
        createEntryViewDetector(core),
        this.entryElementRegistry,
      ),
    }
    this.autoTrackEntryInteractions =
      resolveAutoTrackEntryInteractionOptions(autoTrackEntryInteraction)

    this.tracking = {
      enable: (interaction, options): void => {
        this.autoTrackEntryInteractions[interaction] = true
        this.startEntryInteraction(interaction, options)
      },
      disable: (interaction): void => {
        this.stopEntryInteraction(interaction)
      },
      observe: (interaction, element, options): void => {
        this.trackEntryInteractionElement(interaction, element, options)
      },
      unobserve: (interaction, element): void => {
        this.untrackEntryInteractionElement(interaction, element)
      },
    }
  }

  public reset(): void {
    this.stopAllEntryInteractions()
  }

  public destroy(): void {
    this.stopAllEntryInteractions()
    this.entryElementRegistry.disconnect()
    this.entryExistenceObserver.disconnect()
  }

  public syncAutoTrackedEntryInteractions(hasConsent: boolean): void {
    if (this.autoTrackEntryInteractions.clicks) {
      hasConsent ? this.startEntryInteraction('clicks') : this.stopEntryInteraction('clicks')
    }

    if (this.autoTrackEntryInteractions.views) {
      hasConsent ? this.startEntryInteraction('views') : this.stopEntryInteraction('views')
    }
  }

  private startEntryInteraction<TInteraction extends EntryInteraction>(
    interaction: TInteraction,
    options?: EntryInteractionStartOptions<TInteraction>,
  ): void {
    this.stopEntryInteraction(interaction)

    if (interaction === 'clicks') {
      this.entryInteractionTrackers.clicks.start()
      return
    }

    this.entryInteractionTrackers.views.start(options)
  }

  private stopEntryInteraction(interaction: EntryInteraction): void {
    this.entryInteractionTrackers[interaction].stop()
  }

  private stopAllEntryInteractions(): void {
    this.stopEntryInteraction('clicks')
    this.stopEntryInteraction('views')
  }

  private trackEntryInteractionElement<TInteraction extends EntryElementInteraction>(
    interaction: TInteraction,
    element: Element,
    options: EntryInteractionElementOptions<TInteraction>,
  ): void {
    if (interaction === 'clicks') {
      this.entryInteractionTrackers.clicks.trackElement?.(element, options)
      return
    }

    this.entryInteractionTrackers.views.trackElement?.(element, options)
  }

  private untrackEntryInteractionElement(
    interaction: EntryElementInteraction,
    element: Element,
  ): void {
    this.entryInteractionTrackers[interaction].untrackElement?.(element)
  }
}
