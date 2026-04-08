import type {
  ChangeArray,
  ExperienceEvent as ExperienceEventPayload,
  InsightsEvent as InsightsEventPayload,
  Json,
  MergeTagEntry,
  OptimizationData,
  PartialProfile,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger, logger } from '@contentful/optimization-api-client/logger'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import { isEqual } from 'es-toolkit/predicate'
import type { BlockedEvent } from './BlockedEvent'
import type { ConsentGuard } from './Consent'
import CoreBase from './CoreBase'
import type { CoreStatefulConfig, EventType } from './CoreStateful'
import type {
  ClickBuilderArgs,
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
import type { ResolvedData } from './resolvers'
import {
  blockedEvent as blockedEventSignal,
  changes as changesSignal,
  consent as consentSignal,
  type Observable,
  profile as profileSignal,
  selectedOptimizations as selectedOptimizationsSignal,
  signalFns,
  toDistinctObservable,
} from './signals'

const coreLogger = createScopedLogger('CoreStateful')

const CONSENT_EVENT_TYPE_MAP: Readonly<Partial<Record<string, EventType>>> = {
  trackView: 'component',
  trackFlagView: 'component',
  trackClick: 'component_click',
  trackHover: 'component_hover',
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

  protected abstract readonly allowedEventTypes: EventType[]
  protected abstract readonly experienceQueue: ExperienceQueue
  protected abstract readonly insightsQueue: InsightsQueue
  protected abstract readonly onEventBlocked?: CoreStatefulConfig['onEventBlocked']

  override getFlag(name: string, changes: ChangeArray | undefined = changesSignal.value): Json {
    const value = super.getFlag(name, changes)
    const payload = this.buildFlagViewBuilderArgs(name, changes)

    void this.trackFlagView(payload).catch((error: unknown) => {
      logger.warn(`Failed to emit "flag view" event for "${name}"`, String(error))
    })

    return value
  }

  override resolveOptimizedEntry<
    S extends EntrySkeletonType = EntrySkeletonType,
    L extends LocaleCode = LocaleCode,
  >(
    entry: Entry<S, undefined, L>,
    selectedOptimizations?: SelectedOptimizationArray,
  ): ResolvedData<S, undefined, L>
  override resolveOptimizedEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers = ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(entry: Entry<S, M, L>, selectedOptimizations?: SelectedOptimizationArray): ResolvedData<S, M, L>
  override resolveOptimizedEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(
    entry: Entry<S, M, L>,
    selectedOptimizations:
      | SelectedOptimizationArray
      | undefined = selectedOptimizationsSignal.value,
  ): ResolvedData<S, M, L> {
    return super.resolveOptimizedEntry(entry, selectedOptimizations)
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
   * @returns The resulting {@link OptimizationData} for the identified user.
   * @example
   * ```ts
   * const data = await core.identify({ userId: 'user-123', traits: { plan: 'pro' } })
   * ```
   */
  async identify(
    payload: IdentifyBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData | undefined> {
    const { profile, ...builderArgs } = payload
    return await this.sendExperienceEvent(
      'identify',
      [payload],
      this.eventBuilder.buildIdentify(builderArgs),
      profile,
    )
  }

  /**
   * Convenience wrapper for sending a `page` event through the Experience path.
   *
   * @param payload - Page view builder arguments.
   * @returns The evaluated {@link OptimizationData} for this page view.
   * @example
   * ```ts
   * const data = await core.page({ properties: { title: 'Home' } })
   * ```
   */
  async page(
    payload: PageViewBuilderArgs & { profile?: PartialProfile } = {},
  ): Promise<OptimizationData | undefined> {
    const { profile, ...builderArgs } = payload
    return await this.sendExperienceEvent(
      'page',
      [payload],
      this.eventBuilder.buildPageView(builderArgs),
      profile,
    )
  }

  /**
   * Convenience wrapper for sending a `screen` event through the Experience path.
   *
   * @param payload - Screen view builder arguments.
   * @returns The evaluated {@link OptimizationData} for this screen view.
   * @example
   * ```ts
   * const data = await core.screen({ name: 'HomeScreen' })
   * ```
   */
  async screen(
    payload: ScreenViewBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData | undefined> {
    const { profile, ...builderArgs } = payload
    return await this.sendExperienceEvent(
      'screen',
      [payload],
      this.eventBuilder.buildScreenView(builderArgs),
      profile,
    )
  }

  /**
   * Convenience wrapper for sending a custom `track` event through the Experience path.
   *
   * @param payload - Track builder arguments.
   * @returns The evaluated {@link OptimizationData} for this event.
   * @example
   * ```ts
   * const data = await core.track({ event: 'button_click', properties: { label: 'Buy' } })
   * ```
   */
  async track(
    payload: TrackBuilderArgs & { profile?: PartialProfile },
  ): Promise<OptimizationData | undefined> {
    const { profile, ...builderArgs } = payload
    return await this.sendExperienceEvent(
      'track',
      [payload],
      this.eventBuilder.buildTrack(builderArgs),
      profile,
    )
  }

  /**
   * Track an entry view through Insights and, when sticky, Experience.
   *
   * @param payload - Entry view builder arguments. When `payload.sticky` is
   *   `true`, the event will also be sent through Experience as a sticky
   *   entry view.
   * @returns A promise that resolves when all delegated calls complete.
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
  ): Promise<OptimizationData | undefined> {
    const { profile, ...builderArgs } = payload
    let result: OptimizationData | undefined = undefined

    if (payload.sticky) {
      result = await this.sendExperienceEvent(
        'trackView',
        [payload],
        this.eventBuilder.buildView(builderArgs),
        profile,
      )
    }
    await this.sendInsightsEvent(
      'trackView',
      [payload],
      this.eventBuilder.buildView(builderArgs),
      profile,
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
    await this.sendInsightsEvent('trackClick', [payload], this.eventBuilder.buildClick(payload))
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
    await this.sendInsightsEvent('trackHover', [payload], this.eventBuilder.buildHover(payload))
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
    const { [name]: mappedEventType } = CONSENT_EVENT_TYPE_MAP
    const isAllowed =
      mappedEventType !== undefined
        ? this.allowedEventTypes.includes(mappedEventType)
        : this.allowedEventTypes.some((eventType) => eventType === name)

    return !!consentSignal.value || isAllowed
  }

  onBlockedByConsent(name: string, args: readonly unknown[]): void {
    coreLogger.warn(
      `Event "${name}" was blocked due to lack of consent; payload: ${JSON.stringify(args)}`,
    )
    this.reportBlockedEvent('consent', name, args)
  }

  protected async sendExperienceEvent(
    method: string,
    args: readonly unknown[],
    event: ExperienceEventPayload,
    _profile?: PartialProfile,
  ): Promise<OptimizationData | undefined> {
    if (!this.hasConsent(method)) {
      this.onBlockedByConsent(method, args)
      return undefined
    }

    return await this.experienceQueue.send(event)
  }

  protected async sendInsightsEvent(
    method: string,
    args: readonly unknown[],
    event: InsightsEventPayload,
    _profile?: PartialProfile,
  ): Promise<void> {
    if (!this.hasConsent(method)) {
      this.onBlockedByConsent(method, args)
      return
    }

    await this.insightsQueue.send(event)
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

  protected getFlagObservable(name: string): Observable<Json> {
    const existingObservable = this.flagObservables.get(name)
    if (existingObservable) return existingObservable

    const trackFlagView = this.trackFlagView.bind(this)
    const buildFlagViewBuilderArgs = this.buildFlagViewBuilderArgs.bind(this)
    const valueSignal = signalFns.computed<Json>(() => super.getFlag(name, changesSignal.value))
    const distinctObservable = toDistinctObservable(valueSignal, isEqual)

    const trackedObservable: Observable<Json> = {
      get current() {
        const { current: value } = distinctObservable
        const payload = buildFlagViewBuilderArgs(name, changesSignal.value)

        void trackFlagView(payload).catch((error: unknown) => {
          logger.warn(`Failed to emit "flag view" event for "${name}"`, String(error))
        })

        return value
      },

      subscribe: (next) =>
        distinctObservable.subscribe((value) => {
          const payload = buildFlagViewBuilderArgs(name, changesSignal.value)

          void trackFlagView(payload).catch((error: unknown) => {
            logger.warn(`Failed to emit "flag view" event for "${name}"`, String(error))
          })
          next(value)
        }),

      subscribeOnce: (next) =>
        distinctObservable.subscribeOnce((value) => {
          const payload = buildFlagViewBuilderArgs(name, changesSignal.value)

          void trackFlagView(payload).catch((error: unknown) => {
            logger.warn(`Failed to emit "flag view" event for "${name}"`, String(error))
          })
          next(value)
        }),
    }

    this.flagObservables.set(name, trackedObservable)

    return trackedObservable
  }

  private reportBlockedEvent(
    reason: BlockedEvent['reason'],
    method: string,
    args: readonly unknown[],
  ): void {
    const event: BlockedEvent = { reason, method, args }

    try {
      this.onEventBlocked?.(event)
    } catch (error) {
      coreLogger.warn(`onEventBlocked callback failed for method "${method}"`, error)
    }

    blockedEventSignal.value = event
  }
}

export default CoreStatefulEventEmitter
