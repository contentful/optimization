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
  CoreStateful,
  effect,
  resolveStatefulDefaults,
  signals,
  type CoreStatefulConfig,
  type EventEmissionResult,
  type PageViewBuilderArgs,
} from '@contentful/optimization-core'
import type { App } from '@contentful/optimization-core/api-schemas'
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
 * Controls how {@link ContentfulOptimization.trackCurrentPage} treats the first route.
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
   * Controls the first route emission. SSR integrations can use `skip` when
   * the server already emitted the same page event.
   */
  readonly initialPageEvent?: InitialCurrentPageEvent
  /**
   * Builds the page payload only when a page event will be emitted.
   */
  readonly buildPayload: (metadata: CurrentPageEmissionMetadata) => PageViewBuilderArgs | undefined
}

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
class ContentfulOptimization extends CoreStateful {
  private readonly currentPageTracker = new AcceptedCurrentStateTracker<string>()

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
      await this.flushQueues({ force: true, beacon: beaconHandler })
    })

    effect(() => {
      const {
        changes: { value },
        persistenceConsent: { value: persistenceConsent },
      } = signals

      if (persistenceConsent === true) LocalStore.changes = value
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

      if (persistenceConsent !== true) return

      LocalStore.profile = value
      this.setAnonymousId(value?.id ?? LocalStore.anonymousId)
    })

    effect(() => {
      const {
        persistenceConsent: { value: persistenceConsent },
        selectedOptimizations: { value },
      } = signals

      if (persistenceConsent === true) LocalStore.selectedOptimizations = value
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
    this.entryInteractionRuntime.reset()
    removeCookie(ANONYMOUS_ID_COOKIE, this.cookieAttributes)
    LocalStore.reset()
    super.reset()
  }

  /**
   * Track the current browser page with route-key deduplication.
   *
   * @remarks
   * This is intended for router integrations. Manual `page()` calls remain
   * direct emits and are not deduplicated.
   *
   * @public
   */
  async trackCurrentPage({
    buildPayload,
    initialPageEvent = 'emit',
    routeKey,
  }: TrackCurrentPageOptions): Promise<EventEmissionResult> {
    if (initialPageEvent === 'skip' && !this.currentPageTracker.hasAccepted()) {
      this.currentPageTracker.markAccepted(routeKey)
      return { accepted: true }
    }

    const isInitialEmission = !this.currentPageTracker.hasAccepted()
    const result = await this.currentPageTracker.emitIfNeeded({
      key: routeKey,
      isAllowed: this.hasConsent('page'),
      emit: async () => await this.page(buildPayload({ isInitialEmission }) ?? {}),
    })

    if (!result.accepted) return { accepted: false }
    if (result.data === undefined) return { accepted: true }

    return { accepted: true, data: result.data }
  }

  /**
   * Destroy the Web SDK instance and release runtime resources.
   *
   * @remarks
   * Intended for explicit teardown in tests and hot-reload paths. This does not
   * clear persisted user state.
   */
  destroy(): void {
    this.entryInteractionRuntime.destroy()
    this.cleanupOnlineListener()
    this.cleanupVisibilityListener()

    if (typeof window !== 'undefined' && window.contentfulOptimization === this) {
      delete window.contentfulOptimization
    }

    super.destroy()
  }
}

export default ContentfulOptimization
