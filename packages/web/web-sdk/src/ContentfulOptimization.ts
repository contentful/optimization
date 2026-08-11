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
  CoreStateful,
  resolveStatefulDefaults,
  signals,
  type CoreStatefulConfig,
  type CurrentStateTrackingResult,
  type PageViewBuilderArgs,
} from '@contentful/optimization-core'
import type { App } from '@contentful/optimization-core/api-schemas'
import {
  CORE_BRIDGE_CAPABILITIES_SYMBOL,
  type CoreBridgeCapabilities,
  type CoreBridgeHost,
} from '@contentful/optimization-core/bridge-support'
import { ANONYMOUS_ID_COOKIE_LEGACY } from '@contentful/optimization-core/constants'
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
  /**
   * Controls the current route emission. SSR integrations can use `skip` when
   * the server already emitted this route's page event.
   */
  readonly initialPageEvent?: InitialCurrentPageEvent
  /**
   * Builds the page payload only when a page event will be emitted.
   */
  readonly buildPayload: (metadata: CurrentPageEmissionMetadata) => PageViewBuilderArgs | undefined
}

/**
 * Skip-only options for {@link ContentfulOptimization.trackCurrentPage}.
 *
 * @public
 */
export interface TrackCurrentPageSkipOptions {
  /**
   * Stable route identity used for current-page deduplication.
   */
  readonly routeKey: string
  /**
   * Marks the current route accepted without emitting a page event.
   */
  readonly initialPageEvent: 'skip'
  /**
   * Ignored for skip-only tracking. Kept for callers that share option builders.
   */
  readonly buildPayload?: TrackCurrentPageOptions['buildPayload']
}

/**
 * Result of tracking the current browser page.
 *
 * @remarks
 * An accepted result includes optional optimization data. A rejected result identifies whether the
 * route was already accepted, tracking was not allowed, or a newer current-route operation
 * superseded this attempt.
 *
 * Emitted routes are online-only. An offline call resolves as `not-allowed` without publishing or
 * enqueueing an event and must be called again explicitly after reconnecting. A skip remains
 * accepted without emitting.
 *
 * A current emission failure rejects. A failure from an attempt replaced by a newer route resolves
 * as `superseded`.
 *
 * @public
 */
export type TrackCurrentPageResult = CurrentStateTrackingResult

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

function canPersistDurableContinuity(persistenceConsent: boolean | undefined): boolean {
  const hasProfile = signals.profile.value !== undefined

  if (hasProfile && !isDurableContinuityPersistenceSuppressed()) {
    clearProfilelessHandoffDurableContinuity()
  }

  return persistenceConsent === true && !shouldSkipDurableContinuityPersistence(hasProfile)
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

  private hasAcceptedCurrentPage = false

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
   *   clientId: 'abc-123',
   *   environment: 'main',
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

    try {
      clearProfilelessHandoffDurableContinuity()

      const canLoadPersistedContinuity = mergedConfig.defaults?.persistenceConsent === true
      const { cookieValue, legacyCookieValue } = readInitialCookieValues(canLoadPersistedContinuity)

      const entryInteractionRuntime = new EntryInteractionRuntime(this, autoTrackEntryInteraction)
      const { tracking } = entryInteractionRuntime
      this.entryInteractionRuntime = entryInteractionRuntime
      this.tracking = tracking
      this.registerDisposer(() => {
        entryInteractionRuntime.destroy()
      })

      this.cookieAttributes = {
        domain: mergedConfig.cookie?.domain,
        expires: mergedConfig.cookie?.expires ?? EXPIRATION_DAYS_DEFAULT,
      }

      this.registerDisposer(
        createOnlineChangeListener((isOnline) => {
          this.online = isOnline
        }),
      )

      this.registerDisposer(
        createVisibilityChangeListener(async () => {
          this.entryInteractionRuntime.flushActiveInteractions()
          await this.flushQueues({ force: true, beacon: beaconHandler })
        }),
      )

      this.registerEffect(() => {
        const {
          changes: { value },
          persistenceConsent: { value: persistenceConsent },
        } = signals

        if (canPersistDurableContinuity(persistenceConsent)) LocalStore.changes = value
      })

      this.registerEffect(() => {
        const {
          consent: { value },
        } = signals

        this.entryInteractionRuntime.syncAutoTrackedEntryInteractions()
        LocalStore.consent = value
      })

      this.registerEffect(() => {
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

      this.registerEffect(() => {
        const {
          persistenceConsent: { value: persistenceConsent },
          profile: { value },
        } = signals

        if (value !== undefined && !isDurableContinuityPersistenceSuppressed()) {
          clearProfilelessHandoffDurableContinuity()
        }

        if (persistenceConsent !== true) return

        LocalStore.profile = value
        this.setAnonymousId(value?.id ?? LocalStore.anonymousId)
      })

      this.registerEffect(() => {
        const {
          persistenceConsent: { value: persistenceConsent },
          selectedOptimizations: { value },
        } = signals

        if (canPersistDurableContinuity(persistenceConsent)) {
          LocalStore.selectedOptimizations = value
        }
      })

      this.initializeFromCookieValues(cookieValue, legacyCookieValue)

      if (typeof window !== 'undefined') window.contentfulOptimization ??= this
      this.registerDisposer(() => {
        clearProfilelessHandoffDurableContinuity()

        if (typeof window !== 'undefined' && window.contentfulOptimization === this) {
          delete window.contentfulOptimization
        }
      })
    } catch (error) {
      super.destroy()
      throw error
    }
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
    this.hasAcceptedCurrentPage = false
    this.entryInteractionRuntime.reset()
    removeCookie(ANONYMOUS_ID_COOKIE, this.cookieAttributes)
    LocalStore.reset()
    clearProfilelessHandoffDurableContinuity()
    super.reset()
  }

  /**
   * Track the current browser page with route-key deduplication.
   *
   * @remarks
   * This is intended for router integrations. Manual `page()` calls remain
   * direct emits and are not deduplicated. Emitted routes are online-only; reconnecting after an
   * offline result does not retry the route automatically.
   *
   * @returns The current-page outcome. Current failures reject, while superseded attempts resolve
   * with `{ accepted: false, reason: 'superseded' }`.
   *
   * @public
   */
  async trackCurrentPage(
    options: TrackCurrentPageOptions | TrackCurrentPageSkipOptions,
  ): Promise<TrackCurrentPageResult> {
    const { routeKey } = options

    if (options.initialPageEvent === 'skip') {
      this.hasAcceptedCurrentPage = true
      return this.markCurrentStateAccepted(routeKey)
    }

    const { buildPayload } = options
    const isInitialEmission = !this.hasAcceptedCurrentPage
    const result = await this.emitCurrentPage(routeKey, () => buildPayload({ isInitialEmission }))

    if (result.accepted) this.hasAcceptedCurrentPage = true
    return result
  }

  /**
   * Destroy the Web SDK instance and release runtime resources.
   *
   * @remarks
   * Intended for explicit teardown in tests and hot-reload paths. This does not
   * clear persisted user state.
   */
  destroy(): void {
    super.destroy()
  }
}

export default ContentfulOptimization
