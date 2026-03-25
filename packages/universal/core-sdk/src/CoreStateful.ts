import type {
  ChangeArray,
  ExperienceEvent as ExperienceEventPayload,
  InsightsEvent as InsightsEventPayload,
  Json,
  MergeTagEntry,
  OptimizationData,
  PartialProfile,
  Profile,
  SelectedPersonalizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger, logger } from '@contentful/optimization-api-client/logger'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import { isEqual } from 'es-toolkit/predicate'
import type { BlockedEvent } from './BlockedEvent'
import type { ConsentController, ConsentGuard } from './Consent'
import CoreBase, { type CoreConfig, type EventType } from './CoreBase'
import type { FlagViewBuilderArgs } from './events'
import { toPositiveInt } from './lib/number'
import { type QueueFlushPolicy, resolveQueueFlushPolicy } from './lib/queue'
import {
  acquireStatefulRuntimeSingleton,
  releaseStatefulRuntimeSingleton,
} from './lib/singleton/StatefulRuntimeSingleton'
import { ExperienceQueue, type ExperienceQueueDropContext } from './queues/ExperienceQueue'
import { InsightsQueue } from './queues/InsightsQueue'
import type { ResolvedData } from './resolvers'
import {
  batch,
  blockedEvent as blockedEventSignal,
  canPersonalize as canPersonalizeSignal,
  changes as changesSignal,
  consent as consentSignal,
  effect,
  event as eventSignal,
  type Observable,
  online as onlineSignal,
  previewPanelAttached as previewPanelAttachedSignal,
  previewPanelOpen as previewPanelOpenSignal,
  profile as profileSignal,
  selectedPersonalizations as selectedPersonalizationsSignal,
  signalFns,
  type SignalFns,
  signals,
  type Signals,
  toDistinctObservable,
  toObservable,
} from './signals'
import { PREVIEW_PANEL_SIGNAL_FNS_SYMBOL, PREVIEW_PANEL_SIGNALS_SYMBOL } from './symbols'

const coreLogger = createScopedLogger('CoreStateful')

const DEFAULT_ALLOWED_EVENT_TYPES: EventType[] = ['identify', 'page', 'screen']
const OFFLINE_QUEUE_MAX_EVENTS = 100
const CONSENT_EVENT_TYPE_MAP: Readonly<Partial<Record<string, EventType>>> = {
  trackView: 'component',
  trackFlagView: 'component',
  trackClick: 'component_click',
  trackHover: 'component_hover',
}
export type { ExperienceQueueDropContext } from './queues/ExperienceQueue'

/**
 * Unified queue policy for stateful Core.
 *
 * @public
 */
export interface QueuePolicy {
  /** Shared retry/backoff/circuit policy for queued flushes. */
  flush?: QueueFlushPolicy
  /** Maximum number of offline Experience events retained. */
  offlineMaxEvents?: number
  /** Callback invoked when oldest offline Experience events are dropped. */
  onOfflineDrop?: (context: ExperienceQueueDropContext) => void
}

interface ResolvedQueuePolicy {
  flush: ReturnType<typeof resolveQueueFlushPolicy>
  offlineMaxEvents: number
  onOfflineDrop?: QueuePolicy['onOfflineDrop']
}

const resolveQueuePolicy = (policy: QueuePolicy | undefined): ResolvedQueuePolicy => ({
  flush: resolveQueueFlushPolicy(policy?.flush),
  offlineMaxEvents: toPositiveInt(policy?.offlineMaxEvents, OFFLINE_QUEUE_MAX_EVENTS),
  onOfflineDrop: policy?.onOfflineDrop,
})

/**
 * Symbol-keyed signal bridge shared between core and first-party preview tooling.
 *
 * @public
 */
export interface PreviewPanelSignalObject {
  /** Signals instance populated by {@link CoreStateful.registerPreviewPanel}. */
  [PREVIEW_PANEL_SIGNALS_SYMBOL]?: Signals | null | undefined
  /** Signal helper functions populated by {@link CoreStateful.registerPreviewPanel}. */
  [PREVIEW_PANEL_SIGNAL_FNS_SYMBOL]?: SignalFns | null | undefined
}

/**
 * Combined observable state exposed by the stateful core.
 *
 * @public
 */
export interface CoreStates {
  /** Current consent value (if any). */
  consent: Observable<boolean | undefined>
  /** Whether the preview panel has been attached to the host runtime. */
  previewPanelAttached: Observable<boolean>
  /** Whether the preview panel is currently open in the host runtime. */
  previewPanelOpen: Observable<boolean>
  /** Stream of the most recent blocked event payload. */
  blockedEventStream: Observable<BlockedEvent | undefined>
  /** Stream of the most recent event emitted. */
  eventStream: Observable<InsightsEventPayload | ExperienceEventPayload | undefined>
  /** Key-scoped observable for a single Custom Flag value. */
  flag: (name: string) => Observable<Json>
  /** Live view of the current profile. */
  profile: Observable<Profile | undefined>
  /** Live view of selected personalizations (variants). */
  selectedPersonalizations: Observable<SelectedPersonalizationArray | undefined>
  /** Whether personalization data is currently available. */
  canPersonalize: Observable<boolean>
}

/**
 * Default values used to preconfigure the stateful core.
 *
 * @public
 */
export interface CoreConfigDefaults {
  /** Global consent default applied at construction time. */
  consent?: boolean
  /** Default active profile used for personalization and insights. */
  profile?: Profile
  /** Initial diff of changes produced by the service. */
  changes?: ChangeArray
  /** Preselected personalization variants (e.g., winning treatments). */
  personalizations?: SelectedPersonalizationArray
}

/**
 * Configuration for {@link CoreStateful}.
 *
 * @public
 */
export interface CoreStatefulConfig extends CoreConfig {
  /**
   * Allow-listed event type strings permitted when consent is not set.
   */
  allowedEventTypes?: EventType[]

  /** Optional set of default values applied on initialization. */
  defaults?: CoreConfigDefaults

  /** Function used to obtain an anonymous user identifier. */
  getAnonymousId?: () => string | undefined

  /**
   * Callback invoked whenever an event call is blocked by checks.
   */
  onEventBlocked?: (event: BlockedEvent) => void

  /** Unified queue policy for queued stateful work. */
  queuePolicy?: QueuePolicy
}

let statefulInstanceCounter = 0

/**
 * Core runtime that owns stateful event delivery, consent, and shared signals.
 *
 * @public
 */
class CoreStateful extends CoreBase implements ConsentController, ConsentGuard {
  private readonly singletonOwner: string
  private destroyed = false
  private readonly flagObservables = new Map<string, Observable<Json>>()
  private readonly allowedEventTypes: EventType[]
  private readonly experienceQueue: ExperienceQueue
  private readonly insightsQueue: InsightsQueue
  private readonly onEventBlocked?: CoreStatefulConfig['onEventBlocked']

  /**
   * Expose merged observable state for consumers.
   */
  readonly states: CoreStates = {
    blockedEventStream: toObservable(blockedEventSignal),
    flag: (name: string): Observable<Json> => this.getFlagObservable(name),
    consent: toObservable(consentSignal),
    eventStream: toObservable(eventSignal),
    canPersonalize: toObservable(canPersonalizeSignal),
    selectedPersonalizations: toObservable(selectedPersonalizationsSignal),
    previewPanelAttached: toObservable(previewPanelAttachedSignal),
    previewPanelOpen: toObservable(previewPanelOpenSignal),
    profile: toObservable(profileSignal),
  }

  constructor(config: CoreStatefulConfig) {
    super(config)

    this.singletonOwner = `CoreStateful#${++statefulInstanceCounter}`
    acquireStatefulRuntimeSingleton(this.singletonOwner)

    try {
      const { allowedEventTypes, defaults, getAnonymousId, onEventBlocked, queuePolicy } = config
      const {
        changes: defaultChanges,
        consent: defaultConsent,
        personalizations: defaultPersonalizations,
        profile: defaultProfile,
      } = defaults ?? {}
      const resolvedQueuePolicy = resolveQueuePolicy(queuePolicy)

      this.allowedEventTypes = allowedEventTypes ?? DEFAULT_ALLOWED_EVENT_TYPES
      this.onEventBlocked = onEventBlocked
      this.insightsQueue = new InsightsQueue({
        eventInterceptors: this.interceptors.event,
        flushPolicy: resolvedQueuePolicy.flush,
        insightsApi: this.api.insights,
      })
      this.experienceQueue = new ExperienceQueue({
        experienceApi: this.api.experience,
        eventInterceptors: this.interceptors.event,
        flushPolicy: resolvedQueuePolicy.flush,
        getAnonymousId: getAnonymousId ?? (() => undefined),
        offlineMaxEvents: resolvedQueuePolicy.offlineMaxEvents,
        onOfflineDrop: resolvedQueuePolicy.onOfflineDrop,
        stateInterceptors: this.interceptors.state,
      })

      if (defaultConsent !== undefined) consentSignal.value = defaultConsent

      batch(() => {
        if (defaultChanges !== undefined) changesSignal.value = defaultChanges
        if (defaultPersonalizations !== undefined) {
          selectedPersonalizationsSignal.value = defaultPersonalizations
        }
        if (defaultProfile !== undefined) profileSignal.value = defaultProfile
      })

      this.initializeEffects()
    } catch (error) {
      releaseStatefulRuntimeSingleton(this.singletonOwner)
      throw error
    }
  }

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
    selectedPersonalizations?: SelectedPersonalizationArray,
  ): ResolvedData<S, undefined, L>
  override resolveOptimizedEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers = ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(
    entry: Entry<S, M, L>,
    selectedPersonalizations?: SelectedPersonalizationArray,
  ): ResolvedData<S, M, L>
  override resolveOptimizedEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(
    entry: Entry<S, M, L>,
    selectedPersonalizations:
      | SelectedPersonalizationArray
      | undefined = selectedPersonalizationsSignal.value,
  ): ResolvedData<S, M, L> {
    return super.resolveOptimizedEntry(entry, selectedPersonalizations)
  }

  override getMergeTagValue(
    embeddedEntryNodeTarget: MergeTagEntry,
    profile: Profile | undefined = profileSignal.value,
  ): string | undefined {
    return super.getMergeTagValue(embeddedEntryNodeTarget, profile)
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

  private getFlagObservable(name: string): Observable<Json> {
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

  protected override async sendExperienceEvent(
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

  protected override async sendInsightsEvent(
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

  private initializeEffects(): void {
    effect(() => {
      coreLogger.debug(
        `Profile ${profileSignal.value && `with ID ${profileSignal.value.id}`} has been ${profileSignal.value ? 'set' : 'cleared'}`,
      )
    })

    effect(() => {
      coreLogger.debug(
        `Variants have been ${selectedPersonalizationsSignal.value?.length ? 'populated' : 'cleared'}`,
      )
    })

    effect(() => {
      coreLogger.info(
        `Core ${consentSignal.value ? 'will' : 'will not'} emit gated events due to consent (${consentSignal.value})`,
      )
    })

    effect(() => {
      if (!onlineSignal.value) return

      this.insightsQueue.clearScheduledRetry()
      this.experienceQueue.clearScheduledRetry()
      void this.flushQueues({ force: true })
    })
  }

  private async flushQueues(options: { force?: boolean } = {}): Promise<void> {
    await this.insightsQueue.flush(options)
    await this.experienceQueue.flush(options)
  }

  destroy(): void {
    if (this.destroyed) return

    this.destroyed = true
    void this.insightsQueue.flush({ force: true }).catch((error: unknown) => {
      logger.warn('Failed to flush insights queue during destroy()', String(error))
    })
    void this.experienceQueue.flush({ force: true }).catch((error: unknown) => {
      logger.warn('Failed to flush Experience queue during destroy()', String(error))
    })
    this.insightsQueue.clearPeriodicFlushTimer()

    releaseStatefulRuntimeSingleton(this.singletonOwner)
  }

  reset(): void {
    batch(() => {
      blockedEventSignal.value = undefined
      eventSignal.value = undefined
      changesSignal.value = undefined
      profileSignal.value = undefined
      selectedPersonalizationsSignal.value = undefined
    })
  }

  async flush(): Promise<void> {
    await this.flushQueues()
  }

  consent(accept: boolean): void {
    consentSignal.value = accept
  }

  protected get online(): boolean {
    return onlineSignal.value ?? false
  }

  protected set online(isOnline: boolean) {
    onlineSignal.value = isOnline
  }

  registerPreviewPanel(previewPanel: PreviewPanelSignalObject): void {
    Reflect.set(previewPanel, PREVIEW_PANEL_SIGNALS_SYMBOL, signals)
    Reflect.set(previewPanel, PREVIEW_PANEL_SIGNAL_FNS_SYMBOL, signalFns)
  }
}

export default CoreStateful
