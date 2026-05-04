import type { ApiClientConfig } from '@contentful/optimization-api-client'
import type {
  ChangeArray,
  ExperienceEvent as ExperienceEventPayload,
  ExperienceEventType,
  InsightsEvent as InsightsEventPayload,
  InsightsEventType,
  Json,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger, logger } from '@contentful/optimization-api-client/logger'
import type { BlockedEvent } from './BlockedEvent'
import type { ConsentController, ConsentGuard } from './Consent'
import type { CoreStatefulApiConfig } from './CoreApiConfig'
import type { CoreConfig } from './CoreBase'
import CoreStatefulEventEmitter from './CoreStatefulEventEmitter'
import { toPositiveInt } from './lib/number'
import { type QueueFlushPolicy, resolveQueueFlushPolicy } from './lib/queue'
import {
  acquireStatefulRuntimeSingleton,
  releaseStatefulRuntimeSingleton,
} from './lib/singleton/StatefulRuntimeSingleton'
import { ExperienceQueue, type ExperienceQueueDropContext } from './queues/ExperienceQueue'
import { InsightsQueue } from './queues/InsightsQueue'
import {
  batch,
  blockedEvent as blockedEventSignal,
  canOptimize as canOptimizeSignal,
  changes as changesSignal,
  consent as consentSignal,
  effect,
  event as eventSignal,
  type Observable,
  online as onlineSignal,
  previewPanelAttached as previewPanelAttachedSignal,
  previewPanelOpen as previewPanelOpenSignal,
  profile as profileSignal,
  selectedOptimizations as selectedOptimizationsSignal,
  signalFns,
  type SignalFns,
  type Signals,
  signals,
  toObservable,
} from './signals'
import { PREVIEW_PANEL_SIGNAL_FNS_SYMBOL, PREVIEW_PANEL_SIGNALS_SYMBOL } from './symbols'

const coreLogger = createScopedLogger('CoreStateful')

/**
 * Union of all event type keys that stateful Core can emit.
 *
 * @public
 */
export type EventType = InsightsEventType | ExperienceEventType

const DEFAULT_ALLOWED_EVENT_TYPES: EventType[] = ['identify', 'page', 'screen']
const OFFLINE_QUEUE_MAX_EVENTS = 100
export type { ExperienceQueueDropContext } from './queues/ExperienceQueue'

const hasDefinedValues = (record: Record<string, unknown>): boolean =>
  Object.values(record).some((value) => value !== undefined)

const createStatefulExperienceApiConfig = (
  api: CoreStatefulApiConfig | undefined,
): ApiClientConfig['experience'] => {
  if (api === undefined) return undefined

  const experienceConfig = {
    baseUrl: api.experienceBaseUrl,
    enabledFeatures: api.enabledFeatures,
    ip: api.ip,
    locale: api.locale,
    plainText: api.plainText,
    preflight: api.preflight,
  }

  return hasDefinedValues(experienceConfig) ? experienceConfig : undefined
}

const createStatefulInsightsApiConfig = (
  api: CoreStatefulApiConfig | undefined,
): ApiClientConfig['insights'] => {
  if (api === undefined) return undefined

  const insightsConfig = {
    baseUrl: api.insightsBaseUrl,
    beaconHandler: api.beaconHandler,
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
  /** Whether the preview panel is open in the host runtime. */
  previewPanelOpen: Observable<boolean>
  /** Stream of the most recent blocked event payload. */
  blockedEventStream: Observable<BlockedEvent | undefined>
  /** Stream of the most recent event emitted. */
  eventStream: Observable<InsightsEventPayload | ExperienceEventPayload | undefined>
  /** Key-scoped observable for a single Custom Flag value. */
  flag: (name: string) => Observable<Json>
  /** Live view of the current profile. */
  profile: Observable<Profile | undefined>
  /** Live view of selected optimizations (variants). */
  selectedOptimizations: Observable<SelectedOptimizationArray | undefined>
  /** Whether optimization data is available. */
  canOptimize: Observable<boolean>
}

/**
 * Default values used to preconfigure the stateful core.
 *
 * @public
 */
export interface CoreConfigDefaults {
  /** Global consent default applied at construction time. */
  consent?: boolean
  /** Default active profile used for optimization and insights. */
  profile?: Profile
  /** Initial diff of changes produced by the service. */
  changes?: ChangeArray
  /** Preselected optimization variants (e.g., winning treatments). */
  selectedOptimizations?: SelectedOptimizationArray
}

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
class CoreStateful extends CoreStatefulEventEmitter implements ConsentController, ConsentGuard {
  private readonly singletonOwner: string
  private destroyed = false
  protected readonly allowedEventTypes: EventType[]
  protected readonly experienceQueue: ExperienceQueue
  protected readonly insightsQueue: InsightsQueue
  protected readonly onEventBlocked?: CoreStatefulConfig['onEventBlocked']

  /**
   * Expose merged observable state for consumers.
   */
  readonly states: CoreStates = {
    blockedEventStream: toObservable(blockedEventSignal),
    flag: (name: string): Observable<Json> => this.getFlagObservable(name),
    consent: toObservable(consentSignal),
    eventStream: toObservable(eventSignal),
    canOptimize: toObservable(canOptimizeSignal),
    selectedOptimizations: toObservable(selectedOptimizationsSignal),
    previewPanelAttached: toObservable(previewPanelAttachedSignal),
    previewPanelOpen: toObservable(previewPanelOpenSignal),
    profile: toObservable(profileSignal),
  }

  constructor(config: CoreStatefulConfig) {
    super(config, {
      experience: createStatefulExperienceApiConfig(config.api),
      insights: createStatefulInsightsApiConfig(config.api),
    })

    this.singletonOwner = `CoreStateful#${++statefulInstanceCounter}`
    acquireStatefulRuntimeSingleton(this.singletonOwner)

    try {
      const { allowedEventTypes, defaults, getAnonymousId, onEventBlocked, queuePolicy } = config
      const {
        changes: defaultChanges,
        consent: defaultConsent,
        selectedOptimizations: defaultSelectedOptimizations,
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
        if (defaultSelectedOptimizations !== undefined) {
          selectedOptimizationsSignal.value = defaultSelectedOptimizations
        }
        if (defaultProfile !== undefined) profileSignal.value = defaultProfile
      })

      this.initializeEffects()
    } catch (error) {
      releaseStatefulRuntimeSingleton(this.singletonOwner)
      throw error
    }
  }

  private initializeEffects(): void {
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
      selectedOptimizationsSignal.value = undefined
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
