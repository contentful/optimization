import type {
  ApiClientConfig,
  InsightsApiClientRequestOptions,
} from '@contentful/optimization-api-client'
import type {
  Json,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger, logger } from '@contentful/optimization-api-client/logger'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import { installCoreBridgeCapabilities } from './bridge-support/capabilities'
import type { ConsentController, ConsentGuard, ConsentInput } from './consent'
import type { CoreStatefulApiConfig } from './CoreApiConfig'
import type { CoreConfig } from './CoreBase'
import CoreStatefulEventEmitter from './CoreStatefulEventEmitter'
import {
  type AllowedEventType,
  type BlockedEvent,
  DEFAULT_ALLOWED_EVENT_TYPES,
  type EventOptimizationContext,
  type EventType,
  type OptimizationEventStreamEvent,
} from './events'
import { toPositiveInt } from './lib/number'
import { type QueueFlushPolicy, resolveQueueFlushPolicy } from './lib/queue'
import {
  acquireStatefulRuntimeSingleton,
  releaseStatefulRuntimeSingleton,
} from './lib/singleton/StatefulRuntimeSingleton'
import { normalizeExplicitLocale } from './locale'
import { ExperienceQueue, type ExperienceQueueDropContext } from './queues/ExperienceQueue'
import { InsightsQueue } from './queues/InsightsQueue'
import type { ResolvedData } from './resolvers'
import {
  batch,
  blockedEvent as blockedEventSignal,
  canOptimize as canOptimizeSignal,
  changes as changesSignal,
  consent as consentSignal,
  effect,
  event as eventSignal,
  type ExperienceRequestState,
  experienceRequestState as experienceRequestStateSignal,
  locale as localeSignal,
  type Observable,
  online as onlineSignal,
  persistenceConsent as persistenceConsentSignal,
  previewPanelAttached as previewPanelAttachedSignal,
  previewPanelOpen as previewPanelOpenSignal,
  profile as profileSignal,
  selectedOptimizations as selectedOptimizationsSignal,
  signalFns,
  toObservable,
} from './signals'
import { resolveStatefulDefaults, type StatefulDefaults } from './StatefulDefaults'

const coreLogger = createScopedLogger('CoreStateful')

const OFFLINE_QUEUE_MAX_EVENTS = 100
const OPTIMIZATION_CONTEXT_MAX_ENTRIES = 1000
const OPTIMIZATION_CONTEXT_IDLE_TTL_MS = 1_800_000
export type { AllowedEventType, EventType } from './events'
export type { ExperienceQueueDropContext } from './queues/ExperienceQueue'

type PendingEventOptimizationContext = Omit<EventOptimizationContext, 'contextId'>

type RegisteredOptimizationContext = [context: EventOptimizationContext, lastAccessedAt: number]

const hasDefinedValues = (record: Record<string, unknown>): boolean =>
  Object.values(record).some((value) => value !== undefined)

const createStatefulExperienceApiConfig = (
  api: CoreStatefulApiConfig | undefined,
  locale: string | undefined,
): ApiClientConfig['experience'] => {
  if (api === undefined && locale === undefined) return undefined

  const experienceConfig = {
    baseUrl: api?.experienceBaseUrl,
    enabledFeatures: api?.enabledFeatures,
    ip: api?.ip,
    locale,
    plainText: api?.plainText,
    preflight: api?.preflight,
  }

  return hasDefinedValues(experienceConfig) ? experienceConfig : undefined
}

const createStatefulInsightsApiConfig = (
  api: CoreStatefulApiConfig | undefined,
): ApiClientConfig['insights'] => {
  if (api === undefined) return undefined

  const insightsConfig = {
    baseUrl: api.insightsBaseUrl,
  }

  return hasDefinedValues(insightsConfig) ? insightsConfig : undefined
}

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
 * Combined observable state exposed by the stateful core.
 *
 * @public
 */
export interface CoreStates {
  /** Current consent value (if any). */
  consent: Observable<boolean | undefined>
  /** Current durable profile-continuity persistence consent value (if any). */
  persistenceConsent: Observable<boolean | undefined>
  /** Whether the preview panel has been attached to the host runtime. */
  previewPanelAttached: Observable<boolean>
  /** Whether the preview panel is open in the host runtime. */
  previewPanelOpen: Observable<boolean>
  /** Stream of the most recent blocked event payload. */
  blockedEventStream: Observable<BlockedEvent | undefined>
  /** Stream of the most recent event emitted. */
  eventStream: Observable<OptimizationEventStreamEvent | undefined>
  /** Live view of the SDK Experience API/event locale. */
  locale: Observable<string | undefined>
  /** Key-scoped observable for a single Custom Flag value. */
  flag: (name: string) => Observable<Json>
  /** Live view of the current profile. */
  profile: Observable<Profile | undefined>
  /** Live view of selected optimizations (variants). */
  selectedOptimizations: Observable<SelectedOptimizationArray | undefined>
  /** Whether optimization data is available. */
  canOptimize: Observable<boolean>
  /** Whether the current consent + allow-list configuration could ever produce optimizations. */
  optimizationPossible: Observable<boolean>
  /** Outcome of the most recent Experience API request. */
  experienceRequestState: Observable<ExperienceRequestState>
}

/**
 * Default values used to preconfigure the stateful core.
 *
 * @public
 */
export interface CoreConfigDefaults extends StatefulDefaults {}

/**
 * Configuration for {@link CoreStateful}.
 *
 * @public
 */
export interface CoreStatefulConfig extends CoreConfig {
  /**
   * Unified API configuration for stateful environments.
   */
  api?: CoreStatefulApiConfig

  /**
   * Allow-listed event type strings permitted when consent is not set.
   */
  allowedEventTypes?: AllowedEventType[]

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
const OPTIMIZATION_UNLOCKING_EVENT_TYPES: readonly EventType[] = [
  'identify',
  'page',
  'screen',
  'track',
  'group',
  'alias',
  'component',
]

class CoreStateful extends CoreStatefulEventEmitter implements ConsentController, ConsentGuard {
  private readonly singletonOwner: string
  private destroyed = false
  protected readonly allowedEventTypes: AllowedEventType[]
  protected readonly experienceQueue: ExperienceQueue
  protected readonly insightsQueue: InsightsQueue
  protected readonly onEventBlocked?: CoreStatefulConfig['onEventBlocked']
  private readonly optimizationContexts = new Map<string, RegisteredOptimizationContext>()

  private readonly optimizationPossibleSignal = signalFns.computed<boolean>(() => {
    if (consentSignal.value === true) return true
    return OPTIMIZATION_UNLOCKING_EVENT_TYPES.some((type) => this.allowedEventTypes.includes(type))
  })

  /**
   * Expose merged observable state for consumers.
   */
  readonly states: CoreStates = {
    blockedEventStream: toObservable(blockedEventSignal),
    flag: (name: string): Observable<Json> => this.getFlagObservable(name),
    consent: toObservable(consentSignal),
    persistenceConsent: toObservable(persistenceConsentSignal),
    eventStream: toObservable(eventSignal, (event) => event),
    locale: toObservable(localeSignal),
    canOptimize: toObservable(canOptimizeSignal),
    optimizationPossible: toObservable(this.optimizationPossibleSignal),
    experienceRequestState: toObservable(experienceRequestStateSignal),
    selectedOptimizations: toObservable(selectedOptimizationsSignal),
    previewPanelAttached: toObservable(previewPanelAttachedSignal),
    previewPanelOpen: toObservable(previewPanelOpenSignal),
    profile: toObservable(profileSignal),
  }

  constructor(config: CoreStatefulConfig) {
    const locale = normalizeExplicitLocale(config.locale)

    super(
      config,
      {
        experience: createStatefulExperienceApiConfig(config.api, locale),
        insights: createStatefulInsightsApiConfig(config.api),
      },
      locale,
    )

    this.eventBuilder.getConsent = () => consentSignal.value
    this.singletonOwner = `CoreStateful#${++statefulInstanceCounter}`
    acquireStatefulRuntimeSingleton(this.singletonOwner)

    try {
      const { allowedEventTypes, defaults, getAnonymousId, onEventBlocked, queuePolicy } = config
      const {
        defaults: {
          changes: defaultChanges,
          consent: defaultConsent,
          persistenceConsent: defaultPersistenceConsent,
          selectedOptimizations: defaultSelectedOptimizations,
          profile: defaultProfile,
        },
      } = resolveStatefulDefaults(defaults)
      const resolvedQueuePolicy = resolveQueuePolicy(queuePolicy)

      this.allowedEventTypes = allowedEventTypes ?? DEFAULT_ALLOWED_EVENT_TYPES
      this.onEventBlocked = onEventBlocked
      localeSignal.value = locale
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
      installCoreBridgeCapabilities(this, this.interceptors.state)
      batch(() => {
        consentSignal.value = defaultConsent
        persistenceConsentSignal.value = defaultPersistenceConsent ?? defaultConsent
        changesSignal.value = defaultChanges
        selectedOptimizationsSignal.value = defaultSelectedOptimizations
        profileSignal.value = defaultProfile
      })

      this.initializeEffects()
    } catch (error) {
      releaseStatefulRuntimeSingleton(this.singletonOwner)
      throw error
    }
  }

  private initializeEffects(): void {
    this.initializeFlagViewConsentEffect()

    effect(() => {
      coreLogger.debug(
        `Profile ${profileSignal.value && `with ID ${profileSignal.value.id}`} has been ${profileSignal.value ? 'set' : 'cleared'}`,
      )
    })

    effect(() => {
      coreLogger.debug(
        `Variants have been ${selectedOptimizationsSignal.value?.length ? 'populated' : 'cleared'}`,
      )
    })

    effect(() => {
      coreLogger.info(
        `Core ${consentSignal.value ? 'will' : 'will not'} emit gated events due to consent (${consentSignal.value})`,
      )
    })

    effect(() => {
      coreLogger.info(
        `Core ${persistenceConsentSignal.value ? 'will' : 'will not'} persist profile continuity due to persistence consent (${persistenceConsentSignal.value})`,
      )
    })

    effect(() => {
      if (!onlineSignal.value) return

      this.insightsQueue.clearScheduledRetry()
      this.experienceQueue.clearScheduledRetry()
      void this.flushQueues({ force: true })
    })
  }

  protected async flushQueues(
    options: { force?: boolean } & InsightsApiClientRequestOptions = {},
  ): Promise<void> {
    await this.insightsQueue.flush(options)
    await this.experienceQueue.flush(options)
  }

  private clearQueuedEvents(): void {
    this.insightsQueue.clearQueuedEvents()
    this.experienceQueue.clearQueuedEvents()
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
    const { optimizationContext, resolvedData } = this.optimizedEntryResolver.resolveWithContext<
      S,
      M,
      L
    >(entry, selectedOptimizations)

    if (!optimizationContext) return resolvedData

    return {
      ...resolvedData,
      optimizationContextId: this.registerOptimizationContext(optimizationContext),
    }
  }

  protected getEventOptimizationContext(
    optimizationContextId: string | undefined,
  ): EventOptimizationContext | undefined {
    if (optimizationContextId === undefined) return undefined

    const now = Date.now()
    this.pruneOptimizationContexts(now)

    const registered = this.optimizationContexts.get(optimizationContextId)
    if (!registered) return undefined

    const [context] = registered
    registered[1] = now
    this.optimizationContexts.delete(optimizationContextId)
    this.optimizationContexts.set(optimizationContextId, registered)

    return context
  }

  private registerOptimizationContext(
    context: PendingEventOptimizationContext,
  ): EventOptimizationContext['contextId'] {
    const now = Date.now()
    this.pruneOptimizationContexts(now)

    while (this.optimizationContexts.size >= OPTIMIZATION_CONTEXT_MAX_ENTRIES) {
      const oldestContext = this.optimizationContexts.keys().next()
      if (oldestContext.done) break
      this.optimizationContexts.delete(oldestContext.value)
    }

    const contextId = crypto.randomUUID()

    const eventContext: EventOptimizationContext = { contextId, ...context }
    this.optimizationContexts.set(contextId, [eventContext, now])

    return contextId
  }

  private pruneOptimizationContexts(now = Date.now()): void {
    for (const [contextId, [, lastAccessedAt]] of this.optimizationContexts) {
      if (now - lastAccessedAt > OPTIMIZATION_CONTEXT_IDLE_TTL_MS) {
        this.optimizationContexts.delete(contextId)
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return

    this.destroyed = true
    this.optimizationContexts.clear()
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
    this.optimizationContexts.clear()
    batch(() => {
      blockedEventSignal.value = undefined
      eventSignal.value = undefined
      changesSignal.value = undefined
      profileSignal.value = undefined
      selectedOptimizationsSignal.value = undefined
      experienceRequestStateSignal.value = { status: 'idle' }
    })
  }

  async flush(): Promise<void> {
    await this.flushQueues()
  }

  consent(accept: ConsentInput): void {
    const isBoolean = typeof accept === 'boolean'
    const eventConsent = isBoolean ? accept : accept.events
    const persistenceConsent = isBoolean ? accept : accept.persistence

    batch(() => {
      if (eventConsent !== undefined) consentSignal.value = eventConsent
      if (persistenceConsent !== undefined) persistenceConsentSignal.value = persistenceConsent
    })

    if (eventConsent === false) this.clearQueuedEvents()
  }

  /**
   * Update the SDK locale for future Experience API requests and default event context.
   *
   * @param locale - Next SDK Experience API/event locale.
   * @returns The normalized SDK locale.
   *
   * @public
   */
  setLocale(locale: string): string | undefined {
    const resolvedLocale = normalizeExplicitLocale(locale)

    this.setResolvedLocale(resolvedLocale)
    localeSignal.value = resolvedLocale
    this.api.experience.setLocale(resolvedLocale)

    return resolvedLocale
  }

  protected get online(): boolean {
    return onlineSignal.value ?? false
  }

  protected set online(isOnline: boolean) {
    onlineSignal.value = isOnline
  }
}

export default CoreStateful
