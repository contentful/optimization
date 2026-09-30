/**
 * Web SDK entry point for Contentful Optimization.
 *
 * @remarks
 * Exposes a browser-wired {@link ContentfulOptimization} class built on top of {@link CoreStateful}.
 * When executed in a browser environment, the constructor attaches a singleton instance
 * to `window.contentfulOptimization` and the class constructor to `window.ContentfulOptimization` for
 * script-tag / global usage.
 *
 * @internal
 */

import {
  AcceptedCurrentStateTracker,
  assertOptimizationCacheSafety,
  CoreStateful,
  effect,
  resolveStatefulDefaults,
  signals,
  type CoreStatefulConfig,
  type EventEmissionResult,
  type PageViewBuilderArgs,
} from '@contentful/optimization-core'
import type { App } from '@contentful/optimization-core/api-schemas'
import {
  CORE_BRIDGE_CAPABILITIES_SYMBOL,
  type CoreBridgeCapabilities,
  type CoreBridgeHost,
} from '@contentful/optimization-core/bridge-support'
import { ANONYMOUS_ID_COOKIE_LEGACY } from '@contentful/optimization-core/constants'
import { createScopedLogger } from '@contentful/optimization-core/logger'
import { getPageProperties, getUserAgent } from './builders/EventBuilder'
import {
  ANONYMOUS_ID_COOKIE,
  DEFAULT_WEB_ALLOWED_EVENT_TYPES,
  OPTIMIZATION_WEB_SDK_NAME,
  OPTIMIZATION_WEB_SDK_VERSION,
} from './constants'
import type { AutoTrackEntryInteractionOptions, EntryInteractionApi } from './entry-tracking'
import { EntryInteractionRuntime } from './entry-tracking/EntryInteractionRuntime'
import {
  beaconHandler,
  createOnlineChangeListener,
  createVisibilityChangeListener,
} from './handlers'
import {
  hydrateContentOptimizationHandoffState,
  invalidateOptimizationHandoffHydration,
  type BrowserOptimizationHandoff,
} from './handoff'
import { getCookie, removeCookie, setCookie, type CookieAttributes } from './lib/cookies'
import {
  clearProfilelessHandoffDurableContinuity,
  isDurableContinuityPersistenceSuppressed,
  shouldSkipDurableContinuityPersistence,
} from './storage/durableContinuityPersistence'
import LocalStore from './storage/LocalStore'

export type { CookieAttributes } from './lib/cookies'

declare global {
  interface Window {
    /** Global ContentfulOptimization class constructor attached by the Web SDK. */
    ContentfulOptimization?: typeof ContentfulOptimization
    /** Singleton instance created by the Web SDK initializer. */
    contentfulOptimization?: ContentfulOptimization
  }
}

/**
 * Default cookie expiration (in days) used when no explicit value is provided.
 *
 * @internal
 */
const logger = createScopedLogger('Web:Handoff')

function readInitialCookieValues(canLoadPersistedContinuity: boolean): {
  cookieValue?: string
  legacyCookieValue?: string
} {
  if (!canLoadPersistedContinuity) return {}

  const legacyCookieValue = getCookie(ANONYMOUS_ID_COOKIE_LEGACY)

  return {
    cookieValue: legacyCookieValue ?? getCookie(ANONYMOUS_ID_COOKIE),
    legacyCookieValue,
  }
}

function canPersistDurableContinuity(persistenceConsent: boolean | undefined): boolean {
  const hasProfile = signals.profile.value !== undefined

  if (hasProfile && !isDurableContinuityPersistenceSuppressed()) {
    clearProfilelessHandoffDurableContinuity()
  }

  return persistenceConsent === true && !shouldSkipDurableContinuityPersistence(hasProfile)
}

const EXPIRATION_DAYS_DEFAULT = 365

/**
 * Configuration options for the ContentfulOptimization Web SDK.
 *
 * @public
 * @remarks
 * Extends {@link CoreStatefulConfig} with Web-specific options such as the
 * application descriptor and automatic tracked entry interactions.
 */
export interface OptimizationWebConfig extends CoreStatefulConfig {
  /**
   * Application metadata used to identify the Web app in downstream events.
   */
  app?: App

  /**
   * Controls automatic tracking behavior for entry interactions.
   *
   * @remarks
   * Supports entry interactions via the `views`, `clicks`, and `hovers` interactions.
   *
   * @defaultValue `{ views: true, clicks: true, hovers: true }`
   */
  autoTrackEntryInteraction?: AutoTrackEntryInteractionOptions

  /**
   * Cookie configuration used for persisting the anonymous identifier.
   *
   * @remarks
   * Use this to control the cookie domain and expiration.
   */
  cookie?: CookieAttributes
}

/**
 * Public tracking API exposed by {@link ContentfulOptimization#tracking}.
 *
 * @public
 */
export type OptimizationTrackingApi = EntryInteractionApi

/**
 * Metadata passed to current-page payload builders.
 *
 * @public
 */
export interface CurrentPageEmissionMetadata {
  readonly isInitialEmission: boolean
}

/**
 * Controls how {@link ContentfulOptimization.trackCurrentPage} treats the current route.
 *
 * @public
 */
export type InitialCurrentPageEvent = 'emit' | 'skip'

/**
 * Options for {@link ContentfulOptimization.trackCurrentPage}.
 *
 * @public
 */
export interface TrackCurrentPageOptions {
  /**
   * Stable route identity used for current-page deduplication.
   */
  readonly routeKey: string
  /** @deprecated This input is inert. Current-page tracking always emits when admitted. */
  readonly initialPageEvent?: InitialCurrentPageEvent
  /** Builds the page payload. Omit it to emit the legacy empty payload. */
  readonly buildPayload?: (metadata: CurrentPageEmissionMetadata) => PageViewBuilderArgs | undefined
  /** Skip queued work when its owning route effect has been disposed. */
  readonly isCurrent?: () => boolean
}

/** Initial handoff state and event delivery owned by one operation. @public */
export interface HydrateAndTrackCurrentPageOptions extends TrackCurrentPageOptions {
  /** Read router inputs after asynchronous hydration or prerequisite work. */
  readonly getCurrentPage?: () => TrackCurrentPageOptions
  /** Runtime lifetime guard; newer handoffs do not cancel this operation. */
  readonly isCurrent?: () => boolean
  /** Called after state hydration, before any replay events are emitted. */
  readonly onHydrated?: (error?: unknown) => void
  /** Browser prerequisite work when no matching page replay supplies it. */
  readonly beforeInitialPage?: () => Promise<void>
}

/** @deprecated Use {@link TrackCurrentPageOptions}; skip-only tracking is inert. */
export type TrackCurrentPageSkipOptions = TrackCurrentPageOptions

function resolveDefaultState(
  defaults: CoreStatefulConfig['defaults'] | undefined,
): NonNullable<CoreStatefulConfig['defaults']> {
  return resolveStatefulDefaults(defaults, {
    consent: LocalStore.consent,
    persistenceConsent: LocalStore.persistenceConsent,
    profile: () => LocalStore.profile,
    changes: () => LocalStore.changes,
    selectedOptimizations: () => LocalStore.selectedOptimizations,
  }).defaults
}

/**
 * Merge user-supplied Web configuration with sensible defaults for the
 * stateful core and browser environment.
 *
 * @param config - Incoming Web SDK configuration.
 * @returns A fully composed {@link CoreStatefulConfig} object.
 *
 * @remarks
 * This helper wires together:
 * - consent/profile/selectedOptimizations from LocalStore,
 * - Web-specific eventBuilder functions (page, user agent),
 * - browser event defaults,
 * - and anonymous ID retrieval.
 *
 * @internal
 */
function mergeConfig({
  app,
  allowedEventTypes,
  defaults,
  logLevel,
  ...config
}: OptimizationWebConfig): CoreStatefulConfig {
  const baseDefaults = resolveDefaultState(defaults)
  const { eventBuilder: configuredEventBuilder } = config
  const mergedConfig: CoreStatefulConfig = {
    ...config,
    defaults: {
      ...baseDefaults,
      ...defaults,
      persistenceConsent: baseDefaults.persistenceConsent,
    },
    eventBuilder: {
      app,
      channel: 'web',
      getPageProperties,
      getUserAgent,
      ...configuredEventBuilder,
      library: {
        name: OPTIMIZATION_WEB_SDK_NAME,
        version: OPTIMIZATION_WEB_SDK_VERSION,
        ...configuredEventBuilder?.library,
      },
    },
    getAnonymousId:
      config.getAnonymousId ??
      (() => (LocalStore.persistenceConsent === true ? LocalStore.anonymousId : undefined)),
    logLevel: LocalStore.debug ? 'debug' : logLevel,
  }

  mergedConfig.allowedEventTypes ??= allowedEventTypes ?? [...DEFAULT_WEB_ALLOWED_EVENT_TYPES]

  return mergedConfig
}

/**
 * Stateful Web SDK built on top of {@link CoreStateful}.
 *
 * @public
 * @remarks
 * Provides browser-specific wiring:
 * - automatic persistence of consent, profile, and selectedOptimizations,
 * - cookie-based anonymous ID handling,
 * - automatic tracked entry interactions for views, clicks, and hovers,
 * - online-change based flushing of events,
 * - and visibility-change based flushing of events.
 *
 * A singleton instance is attached to `window.contentfulOptimization` when constructed
 * in a browser environment.
 */
class ContentfulOptimization extends CoreStateful implements CoreBridgeHost {
  declare readonly [CORE_BRIDGE_CAPABILITIES_SYMBOL]: CoreBridgeCapabilities

  private readonly currentPageTracker = new AcceptedCurrentStateTracker<string>()
  private readonly handoffOperations = new WeakMap<
    BrowserOptimizationHandoff,
    Promise<EventEmissionResult>
  >()
  private handoffLifetime = 0
  private initialPage: Promise<EventEmissionResult> | undefined = undefined

  /**
   * Tracked entry interaction runtime state and trackers.
   *
   * @internal
   */
  private readonly entryInteractionRuntime: EntryInteractionRuntime
  /**
   * Namespaced tracking controls for automatic and per-element entry interactions.
   *
   * @public
   */
  public readonly tracking: OptimizationTrackingApi

  /**
   * Cookie attributes used when persisting the anonymous identifier.
   *
   * @internal
   */
  private readonly cookieAttributes?: CookieAttributes

  /**
   * Cleanup function for online/offline listener bindings.
   *
   * @internal
   */
  private readonly cleanupOnlineListener: () => void

  /**
   * Cleanup function for visibility listener bindings.
   *
   * @internal
   */
  private readonly cleanupVisibilityListener: () => void

  /**
   * Create a new ContentfulOptimization Web SDK instance.
   *
   * @param config - Web SDK configuration.
   *
   * @throws If an `ContentfulOptimization` instance has already been initialized on
   * `window.contentfulOptimization`.
   *
   * @example
   * ```ts
   * import ContentfulOptimization from '@contentful/optimization-web'
   *
   * const optimization = new ContentfulOptimization({
   *   spaceId: 'abc-123',
   *   environment: 'master',
   *   autoTrackEntryInteraction: { clicks: false },
   * })
   * ```
   */
  constructor(config: OptimizationWebConfig) {
    if (typeof window !== 'undefined' && window.contentfulOptimization)
      throw new Error('ContentfulOptimization is already initialized')

    const { autoTrackEntryInteraction, ...restConfig } = config

    const mergedConfig: OptimizationWebConfig = mergeConfig(restConfig)

    super(mergedConfig)
    clearProfilelessHandoffDurableContinuity()

    const canLoadPersistedContinuity = mergedConfig.defaults?.persistenceConsent === true
    const { cookieValue, legacyCookieValue } = readInitialCookieValues(canLoadPersistedContinuity)

    const entryInteractionRuntime = new EntryInteractionRuntime(this, autoTrackEntryInteraction)
    const { tracking } = entryInteractionRuntime
    this.entryInteractionRuntime = entryInteractionRuntime
    this.tracking = tracking

    this.cookieAttributes = {
      domain: mergedConfig.cookie?.domain,
      expires: mergedConfig.cookie?.expires ?? EXPIRATION_DAYS_DEFAULT,
    }

    this.cleanupOnlineListener = createOnlineChangeListener((isOnline) => {
      this.online = isOnline
    })

    this.cleanupVisibilityListener = createVisibilityChangeListener(async () => {
      await this.entryInteractionRuntime.endActiveInteractions()
      await this.flushQueues({ force: true, beacon: beaconHandler })
    })

    effect(() => {
      const {
        changes: { value },
        persistenceConsent: { value: persistenceConsent },
      } = signals

      if (canPersistDurableContinuity(persistenceConsent)) LocalStore.changes = value
    })

    effect(() => {
      const {
        consent: { value },
      } = signals

      this.entryInteractionRuntime.syncAutoTrackedEntryInteractions()
      LocalStore.consent = value
    })

    effect(() => {
      const {
        persistenceConsent: { value },
      } = signals

      LocalStore.persistenceConsent = value
      if (value === true) this.initializeFromCurrentCookieValues()
      if (value === false) {
        removeCookie(ANONYMOUS_ID_COOKIE, this.cookieAttributes)
        removeCookie(ANONYMOUS_ID_COOKIE_LEGACY, this.cookieAttributes)
        LocalStore.clearProfileContinuity()
      }
    })

    effect(() => {
      const {
        persistenceConsent: { value: persistenceConsent },
        profile: { value },
      } = signals

      if (value !== undefined && !isDurableContinuityPersistenceSuppressed()) {
        clearProfilelessHandoffDurableContinuity()
      }

      if (isDurableContinuityPersistenceSuppressed()) return
      if (persistenceConsent !== true) return

      LocalStore.profile = value
      this.setAnonymousId(value?.id ?? LocalStore.anonymousId)
    })

    effect(() => {
      const {
        persistenceConsent: { value: persistenceConsent },
        selectedOptimizations: { value },
      } = signals

      if (canPersistDurableContinuity(persistenceConsent)) LocalStore.selectedOptimizations = value
    })

    this.initializeFromCookieValues(cookieValue, legacyCookieValue)

    if (typeof window !== 'undefined') window.contentfulOptimization ??= this
  }

  private initializeFromCurrentCookieValues(): void {
    const { cookieValue, legacyCookieValue } = readInitialCookieValues(true)

    this.initializeFromCookieValues(cookieValue, legacyCookieValue)
  }

  /**
   * Initialize anonymous ID state from cookies.
   *
   * @param cookieValue - Anonymous ID read from the current or legacy cookie.
   * @param legacyCookieValue - Anonymous ID read from the legacy cookie, if present.
   * @returns Nothing.
   *
   * @remarks
   * Reads the legacy anonymous ID cookie (if present), migrates to the current cookie,
   * and ensures SDK state is reset when the persisted anonymous ID differs from both the
   * in-memory value and the active profile.
   *
   * @internal
   */
  private initializeFromCookieValues(cookieValue?: string, legacyCookieValue?: string): void {
    if (legacyCookieValue) removeCookie(ANONYMOUS_ID_COOKIE_LEGACY, this.cookieAttributes)

    if (cookieValue && cookieValue !== LocalStore.anonymousId) {
      if (cookieValue !== signals.profile.value?.id) this.reset()
      this.setAnonymousId(cookieValue)
    } else if (legacyCookieValue && cookieValue) {
      this.setAnonymousId(cookieValue)
    }
  }

  /**
   * Persist (or clear) the anonymous ID in both cookies and `LocalStore`.
   *
   * @param value - Anonymous identifier to persist. If omitted, clears persisted state.
   * @returns Nothing.
   *
   * @internal
   */
  private setAnonymousId(value?: string): void {
    if (!value) {
      removeCookie(ANONYMOUS_ID_COOKIE, this.cookieAttributes)
      LocalStore.anonymousId = undefined
      return
    }
    setCookie(ANONYMOUS_ID_COOKIE, value, this.cookieAttributes)
    LocalStore.anonymousId = value
  }

  /**
   * Reset all Web SDK state:
   * - stops auto-tracked entry interactions,
   * - clears the anonymous ID cookie,
   * - clears LocalStore caches,
   * - and delegates to {@link CoreStateful.reset} for underlying state reset.
   *
   * @returns Nothing.
   *
   * @example
   * ```ts
   * optimization.reset()
   * ```
   *
   * @public
   */
  reset(): void {
    this.currentPageTracker.reset()
    this.handoffLifetime += 1
    this.initialPage = undefined
    invalidateOptimizationHandoffHydration()
    this.entryInteractionRuntime.reset()
    removeCookie(ANONYMOUS_ID_COOKIE, this.cookieAttributes)
    LocalStore.reset()
    clearProfilelessHandoffDurableContinuity()
    super.reset()
  }

  /**
   * Apply provisional state and make the initial replay/page decision once.
   * State readiness is reported before delivery, so presentation need not await the result.
   * Repeated calls with the same handoff share its completion; distinct handoffs keep their events.
   * @public
   */
  async hydrateAndTrackCurrentPage(
    handoff: BrowserOptimizationHandoff | undefined,
    options: HydrateAndTrackCurrentPageOptions,
  ): Promise<EventEmissionResult> {
    const existing = handoff === undefined ? undefined : this.handoffOperations.get(handoff)
    if (existing !== undefined) return await existing
    if (handoff !== undefined) assertOptimizationCacheSafety(handoff)
    const { handoffLifetime: lifetime } = this
    const operation = this.currentPageTracker
      .emitIfNeeded({
        key: options.routeKey,
        isAllowed: true,
        deduplicate: false,
        emit: async () => await this.emitInitialPage(handoff, options, lifetime),
      })
      .then(
        (result): EventEmissionResult =>
          result.accepted
            ? result.data === undefined
              ? { accepted: true }
              : { accepted: true, data: result.data }
            : { accepted: false },
      )
    this.initialPage = operation
    if (handoff !== undefined) this.handoffOperations.set(handoff, operation)
    return await operation
  }

  private isCurrentHandoff(options: HydrateAndTrackCurrentPageOptions, lifetime: number): boolean {
    return lifetime === this.handoffLifetime && options.isCurrent?.() !== false
  }

  private async hydrateInitialState(
    handoff: BrowserOptimizationHandoff | undefined,
    options: HydrateAndTrackCurrentPageOptions,
    lifetime: number,
  ): Promise<void> {
    let error: unknown = undefined
    try {
      if (handoff !== undefined)
        await hydrateContentOptimizationHandoffState(this, handoff.state, {
          isCurrent: () => this.isCurrentHandoff(options, lifetime),
          suppressDurableContinuityPersistence: true,
        })
    } catch (hydrationError: unknown) {
      error = hydrationError
      logger.warn('Handoff state could not be applied; continuing browser delivery.', error)
    }
    if (!this.isCurrentHandoff(options, lifetime)) return
    options.onHydrated?.(error)
  }

  private async emitInitialPage(
    handoff: BrowserOptimizationHandoff | undefined,
    options: HydrateAndTrackCurrentPageOptions,
    lifetime: number,
  ): Promise<EventEmissionResult> {
    await this.hydrateInitialState(handoff, options, lifetime)
    if (!this.isCurrentHandoff(options, lifetime)) return { accepted: false }
    const replayResult = await this.tryInitialReplay(handoff, options.routeKey)
    if (replayResult.accepted) return this.promoteCommittedCurrentPage(replayResult)
    if (!this.isCurrentHandoff(options, lifetime)) return { accepted: false }
    await options.beforeInitialPage?.()
    if (!this.isCurrentHandoff(options, lifetime)) return { accepted: false }
    const page = options.getCurrentPage?.() ?? options
    if (page.routeKey !== options.routeKey) return await this.emitCurrentPage(page)
    return await this.emitPage(page)
  }

  private async tryInitialReplay(
    handoff: BrowserOptimizationHandoff | undefined,
    routeKey: string,
  ): Promise<EventEmissionResult> {
    try {
      const replay = handoff?.replay
      if (
        replay !== undefined &&
        (!replay.experience.some((event) => event.type === 'page') || replay.routeKey === routeKey)
      ) {
        return await this.replayOptimizationHandoff({
          ...replay,
          profile: replay.profile ?? handoff?.state?.profile,
        })
      }
    } catch (error: unknown) {
      logger.warn('Private replay failed; using ordinary page tracking.', error)
    }
    return { accepted: false }
  }

  /** Ordinary routing uses the existing accepted/in-flight route tracker. @public */
  async trackCurrentPage(options: TrackCurrentPageOptions): Promise<EventEmissionResult> {
    const { handoffLifetime: lifetime } = this
    await this.initialPage?.catch(() => undefined)
    if (lifetime !== this.handoffLifetime || options.isCurrent?.() === false)
      return { accepted: false }
    return await this.emitCurrentPage(options)
  }

  private async emitCurrentPage(options: TrackCurrentPageOptions): Promise<EventEmissionResult> {
    const result = await this.currentPageTracker.emitIfNeeded({
      key: options.routeKey,
      isAllowed: this.hasConsent('page'),
      emit: async () => await this.emitPage(options),
    })
    return result.accepted
      ? result.data === undefined
        ? { accepted: true }
        : { accepted: true, data: result.data }
      : { accepted: false }
  }

  private async emitPage(options: TrackCurrentPageOptions): Promise<EventEmissionResult> {
    if (!this.hasConsent('page')) return { accepted: false }
    return this.promoteCommittedCurrentPage(
      await this.page(
        options.buildPayload?.({ isInitialEmission: !this.currentPageTracker.hasAccepted() }) ?? {},
      ),
    )
  }

  private promoteCommittedCurrentPage(result: EventEmissionResult): EventEmissionResult {
    if (result.accepted && result.data !== undefined) this.persistCurrentDurableContinuity()

    return result
  }

  private persistCurrentDurableContinuity(): void {
    const {
      changes: { value: changes },
      persistenceConsent: { value: persistenceConsent },
      profile: { value: profile },
      selectedOptimizations: { value: selectedOptimizations },
    } = signals

    if (persistenceConsent !== true) return

    if (profile !== undefined) clearProfilelessHandoffDurableContinuity()

    LocalStore.profile = profile
    this.setAnonymousId(profile?.id ?? LocalStore.anonymousId)

    if (!canPersistDurableContinuity(persistenceConsent)) return

    LocalStore.changes = changes
    LocalStore.selectedOptimizations = selectedOptimizations
  }

  /**
   * Destroy the Web SDK instance and release runtime resources.
   *
   * @remarks
   * Intended for explicit teardown in tests and hot-reload paths. This does not
   * clear persisted user state.
   */
  destroy(): void {
    this.handoffLifetime += 1
    this.initialPage = undefined
    invalidateOptimizationHandoffHydration()
    this.entryInteractionRuntime.destroy()
    this.cleanupOnlineListener()
    this.cleanupVisibilityListener()
    clearProfilelessHandoffDurableContinuity()

    if (typeof window !== 'undefined' && window.contentfulOptimization === this) {
      delete window.contentfulOptimization
    }

    super.destroy()
  }
}

export default ContentfulOptimization
