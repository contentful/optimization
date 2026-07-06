import type {
  ChangeArray,
  ExperienceEvent as ExperienceEventPayload,
  InsightsEvent as InsightsEventPayload,
  Json,
  MergeTagEntry,
  PartialProfile,
  Profile,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger, logger } from '@contentful/optimization-api-client/logger'
import { isEqual } from 'es-toolkit/predicate'
import type { ConsentGuard } from './consent'
import { hasEventConsent } from './consent/ConsentPolicy'
import CoreBase from './CoreBase'
import type { CoreStatefulConfig } from './CoreStateful'
import type {
  AllowedEventType,
  BlockedEvent,
  ClickBuilderArgs,
  EventEmissionResult,
  EventOptimizationContext,
  FlagViewBuilderArgs,
  HoverBuilderArgs,
  IdentifyBuilderArgs,
  PageViewBuilderArgs,
  ScreenViewBuilderArgs,
  TrackBuilderArgs,
  ViewBuilderArgs,
} from './events'
import type { ExperienceQueue } from './queues/ExperienceQueue'
import type { InsightsQueue } from './queues/InsightsQueue'
import {
  blockedEvent as blockedEventSignal,
  changes as changesSignal,
  consent as consentSignal,
  type Observable,
  profile as profileSignal,
  signalFns,
  toDistinctObservable,
} from './signals'

const coreLogger = createScopedLogger('CoreStateful')

type FlagViewTrackingSignature = readonly [
  value: Json,
  componentId: string,
  experienceId: string | undefined,
  variantIndex: number | undefined,
  profileId: string,
]

interface AttemptedFlagViewTrackingSignature {
  attemptId: number
  signature: FlagViewTrackingSignature
}

/**
 * Shared stateful event-emission surface extracted to keep `CoreStateful.ts`
 * below the local max-lines limit while preserving the public API.
 *
 * @internal
 */
abstract class CoreStatefulEventEmitter
  extends CoreBase<CoreStatefulConfig>
  implements ConsentGuard
{
  protected readonly flagObservables = new Map<string, Observable<Json>>()
  private readonly lastAcceptedFlagViewSignatures = new Map<
    string,
    AttemptedFlagViewTrackingSignature
  >()
  private readonly pendingFlagViewSignatures = new Map<
    string,
    AttemptedFlagViewTrackingSignature[]
  >()
  private readonly activeFlagSubscriptionCounts = new Map<string, number>()
  private nextFlagViewTrackingAttemptId = 0

  protected abstract readonly allowedEventTypes: readonly AllowedEventType[]
  protected abstract readonly experienceQueue: ExperienceQueue
  protected abstract readonly insightsQueue: InsightsQueue
  protected abstract readonly onEventBlocked?: CoreStatefulConfig['onEventBlocked']
  protected abstract getEventOptimizationContext(
    optimizationContextId: string | undefined,
  ): EventOptimizationContext | undefined

  override getFlag(name: string, changes: ChangeArray | undefined = changesSignal.value): Json {
    const value = super.getFlag(name, changes)
    this.attemptFlagViewTracking(name, value, changes)

    return value
  }

  override getMergeTagValue(
    embeddedEntryNodeTarget: MergeTagEntry,
    profile: Profile | undefined = profileSignal.value,
  ): string | undefined {
    return super.getMergeTagValue(embeddedEntryNodeTarget, profile)
  }

  /**
   * Convenience wrapper for sending an `identify` event through the Experience path.
   *
   * @param payload - Identify builder arguments.
   * @returns Whether the event was accepted and any resulting {@link OptimizationData}.
   * @example
   * ```ts
   * const { accepted, data } = await core.identify({
   *   userId: 'user-123',
   *   traits: { plan: 'pro' },
   * })
   * ```
   */
  async identify(
    payload: IdentifyBuilderArgs & { profile?: PartialProfile },
  ): Promise<EventEmissionResult> {
    return await this.sendExperienceEventWithResult(
      'identify',
      [payload],
      this.eventBuilder.buildIdentify(payload),
    )
  }

  /**
   * Convenience wrapper for sending a `page` event through the Experience path.
   *
   * @param payload - Page view builder arguments.
   * @returns Whether the event was accepted and any resulting {@link OptimizationData}.
   * @example
   * ```ts
   * const { accepted, data } = await core.page({ properties: { title: 'Home' } })
   * ```
   */
  async page(
    payload: PageViewBuilderArgs & { profile?: PartialProfile } = {},
  ): Promise<EventEmissionResult> {
    return await this.sendExperienceEventWithResult(
      'page',
      [payload],
      this.eventBuilder.buildPageView(payload),
    )
  }

  /**
   * Convenience wrapper for sending a `screen` event through the Experience path.
   *
   * @param payload - Screen view builder arguments.
   * @returns Whether the event was accepted and any resulting {@link OptimizationData}.
   * @example
   * ```ts
   * const { accepted, data } = await core.screen({ name: 'HomeScreen' })
   * ```
   */
  async screen(
    payload: ScreenViewBuilderArgs & { profile?: PartialProfile },
  ): Promise<EventEmissionResult> {
    return await this.sendExperienceEventWithResult(
      'screen',
      [payload],
      this.eventBuilder.buildScreenView(payload),
    )
  }

  /**
   * Convenience wrapper for sending a custom `track` event through the Experience path.
   *
   * @param payload - Track builder arguments.
   * @returns Whether the event was accepted and any resulting {@link OptimizationData}.
   * @example
   * ```ts
   * const { accepted, data } = await core.track({
   *   event: 'button_click',
   *   properties: { label: 'Buy' },
   * })
   * ```
   */
  async track(
    payload: TrackBuilderArgs & { profile?: PartialProfile },
  ): Promise<EventEmissionResult> {
    return await this.sendExperienceEventWithResult(
      'track',
      [payload],
      this.eventBuilder.buildTrack(payload),
    )
  }

  /**
   * Track an entry view through Insights and, when sticky, Experience.
   *
   * @param payload - Entry view builder arguments. When `payload.sticky` is
   *   `true`, the event will also be sent through Experience as a sticky
   *   entry view.
   * @returns Whether the event was accepted and, for sticky views, any resulting
   * {@link OptimizationData}.
   * @remarks
   * Experience receives sticky entry views only; Insights is always invoked
   * regardless of `sticky`.
   * @example
   * ```ts
   * await core.trackView({ componentId: 'entry-123', sticky: true })
   * ```
   */
  async trackView(
    payload: ViewBuilderArgs & { profile?: PartialProfile },
  ): Promise<EventEmissionResult> {
    const optimizationContext = this.getEventOptimizationContext(payload.optimizationContextId)
    if (!this.hasConsent('trackView')) {
      this.onBlockedByConsent('trackView', [payload])
      return { accepted: false }
    }

    let result: EventEmissionResult = { accepted: true }

    if (payload.sticky) {
      result = await this.sendExperienceEventWithResult(
        'trackView',
        [payload],
        this.eventBuilder.buildView(payload),
        optimizationContext,
      )
    }

    if (!result.accepted) return result

    await this.sendInsightsEvent(
      'trackView',
      [payload],
      this.eventBuilder.buildView(payload),
      optimizationContext,
    )

    return result
  }

  /**
   * Track an entry click through Insights.
   *
   * @param payload - Entry click builder arguments.
   * @returns A promise that resolves when processing completes.
   * @example
   * ```ts
   * await core.trackClick({ componentId: 'entry-123' })
   * ```
   */
  async trackClick(payload: ClickBuilderArgs): Promise<void> {
    await this.sendInsightsEvent(
      'trackClick',
      [payload],
      this.eventBuilder.buildClick(payload),
      this.getEventOptimizationContext(payload.optimizationContextId),
    )
  }

  /**
   * Track an entry hover through Insights.
   *
   * @param payload - Entry hover builder arguments.
   * @returns A promise that resolves when processing completes.
   * @example
   * ```ts
   * await core.trackHover({ componentId: 'entry-123' })
   * ```
   */
  async trackHover(payload: HoverBuilderArgs): Promise<void> {
    await this.sendInsightsEvent(
      'trackHover',
      [payload],
      this.eventBuilder.buildHover(payload),
      this.getEventOptimizationContext(payload.optimizationContextId),
    )
  }

  /**
   * Track a feature flag view through Insights.
   *
   * @param payload - Flag view builder arguments used to build the flag view event.
   * @returns A promise that resolves when processing completes.
   * @example
   * ```ts
   * await core.trackFlagView({ componentId: 'feature-flag-123' })
   * ```
   */
  async trackFlagView(payload: FlagViewBuilderArgs): Promise<void> {
    await this.sendInsightsEvent(
      'trackFlagView',
      [payload],
      this.eventBuilder.buildFlagView(payload),
    )
  }

  hasConsent(name: string): boolean {
    return hasEventConsent(name, consentSignal.value, this.allowedEventTypes)
  }

  private onBlockedByConsent(name: string, args: readonly unknown[]): void {
    coreLogger.warn(
      `Event "${name}" was blocked due to lack of consent; payload: ${JSON.stringify(args)}`,
    )
    this.reportBlockedEvent(name, args)
  }

  protected async sendExperienceEventWithResult(
    method: string,
    args: readonly unknown[],
    event: ExperienceEventPayload,
    optimizationContext?: EventOptimizationContext,
  ): Promise<EventEmissionResult> {
    if (!this.hasConsent(method)) {
      this.onBlockedByConsent(method, args)
      return { accepted: false }
    }

    const data = await this.experienceQueue.send(event, optimizationContext)
    if (data === undefined) return { accepted: true }

    return { accepted: true, data }
  }

  protected async sendInsightsEvent(
    method: string,
    args: readonly unknown[],
    event: InsightsEventPayload,
    optimizationContext?: EventOptimizationContext,
  ): Promise<void> {
    if (!this.hasConsent(method)) {
      this.onBlockedByConsent(method, args)
      return
    }

    await this.insightsQueue.send(event, optimizationContext)
  }

  private buildFlagViewBuilderArgs(
    name: string,
    changes: ChangeArray | undefined = changesSignal.value,
  ): FlagViewBuilderArgs {
    const change = changes?.find((candidate) => candidate.key === name)

    return {
      componentId: name,
      experienceId: change?.meta.experienceId,
      variantIndex: change?.meta.variantIndex,
    }
  }

  private buildFlagViewTrackingSignature(
    value: Json,
    payload: FlagViewBuilderArgs,
    profileId: string,
  ): FlagViewTrackingSignature {
    return [value, payload.componentId, payload.experienceId, payload.variantIndex, profileId]
  }

  protected initializeFlagViewConsentEffect(): void {
    let wasReadyToTrack = this.hasConsent('trackFlagView') && profileSignal.value?.id !== undefined
    let previousProfileId = profileSignal.value?.id

    signalFns.effect(() => {
      const profileId = profileSignal.value?.id
      const isReadyToTrack = this.hasConsent('trackFlagView') && profileId !== undefined

      if (isReadyToTrack && (!wasReadyToTrack || profileId !== previousProfileId)) {
        this.trackActiveFlagSubscriptionViews()
      }

      wasReadyToTrack = isReadyToTrack
      previousProfileId = profileId
    })
  }

  private attemptFlagViewTracking(
    name: string,
    value: Json,
    changes: ChangeArray | undefined = changesSignal.value,
  ): void {
    const payload = this.buildFlagViewBuilderArgs(name, changes)
    const profileId = profileSignal.value?.id

    if (!this.hasConsent('trackFlagView')) {
      this.onBlockedByConsent('trackFlagView', [payload])
      return
    }

    if (profileId === undefined) return

    const signature = this.buildFlagViewTrackingSignature(value, payload, profileId)
    if (isEqual(this.lastAcceptedFlagViewSignatures.get(name)?.signature, signature)) {
      return
    }

    let pendingSignatures = this.pendingFlagViewSignatures.get(name)
    if (pendingSignatures?.some((pending) => isEqual(pending.signature, signature)) === true) {
      return
    }

    pendingSignatures ??= []
    this.pendingFlagViewSignatures.set(name, pendingSignatures)
    const pendingSignature = {
      attemptId: this.nextFlagViewTrackingAttemptId++,
      signature,
    }
    pendingSignatures.push(pendingSignature)

    void this.trackFlagView(payload)
      .then(() => {
        const lastAccepted = this.lastAcceptedFlagViewSignatures.get(name)
        if (!lastAccepted || pendingSignature.attemptId > lastAccepted.attemptId) {
          this.lastAcceptedFlagViewSignatures.set(name, pendingSignature)
        }
      })
      .catch((error: unknown) => {
        logger.warn(`Failed to emit "flag view" event for "${name}"`, String(error))
      })
      .finally(() => {
        const pendingIndex = pendingSignatures.findIndex(
          ({ attemptId }) => attemptId === pendingSignature.attemptId,
        )
        if (pendingIndex !== -1) {
          pendingSignatures.splice(pendingIndex, 1)
        }
        if (pendingSignatures.length === 0) {
          this.pendingFlagViewSignatures.delete(name)
        }
      })
  }

  private trackActiveFlagSubscriptionViews(): void {
    const { value: changes } = changesSignal

    for (const [name, count] of this.activeFlagSubscriptionCounts) {
      if (count <= 0) continue

      this.attemptFlagViewTracking(name, super.getFlag(name, changes), changes)
    }
  }

  private registerActiveFlagSubscription(name: string): () => void {
    this.activeFlagSubscriptionCounts.set(
      name,
      (this.activeFlagSubscriptionCounts.get(name) ?? 0) + 1,
    )

    return () => {
      const nextCount = (this.activeFlagSubscriptionCounts.get(name) ?? 0) - 1

      if (nextCount <= 0) {
        this.activeFlagSubscriptionCounts.delete(name)
        return
      }

      this.activeFlagSubscriptionCounts.set(name, nextCount)
    }
  }

  protected getFlagObservable(name: string): Observable<Json> {
    const existingObservable = this.flagObservables.get(name)
    if (existingObservable) return existingObservable

    const attemptFlagViewTracking = this.attemptFlagViewTracking.bind(this)
    const registerActiveFlagSubscription = this.registerActiveFlagSubscription.bind(this)
    const valueSignal = signalFns.computed<Json>(() => super.getFlag(name, changesSignal.value))
    const distinctObservable = toDistinctObservable(valueSignal, isEqual)

    const trackedObservable: Observable<Json> = {
      get current() {
        const { current: value } = distinctObservable

        attemptFlagViewTracking(name, value, changesSignal.value)

        return value
      },

      subscribe: (next) => {
        const unregister = registerActiveFlagSubscription(name)
        const subscription = distinctObservable.subscribe((value) => {
          attemptFlagViewTracking(name, value, changesSignal.value)
          next(value)
        })

        return {
          unsubscribe: () => {
            subscription.unsubscribe()
            unregister()
          },
        }
      },

      subscribeOnce: (next) =>
        distinctObservable.subscribeOnce((value) => {
          attemptFlagViewTracking(name, value, changesSignal.value)
          next(value)
        }),
    }

    this.flagObservables.set(name, trackedObservable)

    return trackedObservable
  }

  private reportBlockedEvent(method: string, args: readonly unknown[]): void {
    const event: BlockedEvent = { reason: 'consent', method, args }

    try {
      this.onEventBlocked?.(event)
    } catch (error) {
      coreLogger.warn(`onEventBlocked callback failed for method "${method}"`, error)
    }

    blockedEventSignal.value = event
  }
}

export default CoreStatefulEventEmitter
