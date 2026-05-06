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
  type CoreStatefulConfig,
  effect,
  signals,
} from '@contentful/optimization-core'
import type { App } from '@contentful/optimization-core/api-schemas'
import { ANONYMOUS_ID_COOKIE_LEGACY } from '@contentful/optimization-core/constants'
import { getLocale, getPageProperties, getUserAgent } from './builders'
import {
  ANONYMOUS_ID_COOKIE,
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
import { getCookie, removeCookie, setCookie } from './lib/cookies'
import { LocalStore } from './storage'

declare global {
  interface Window {
    /** Global ContentfulOptimization class constructor attached by the Web SDK. */
    ContentfulOptimization?: typeof ContentfulOptimization
    /** Singleton instance created by the Web SDK initializer. */
    contentfulOptimization?: ContentfulOptimization
  }
}

/**
 * Supported cookie attributes for the Web SDK.
 *
 * @public
 * @remarks
 * These options are used when persisting the anonymous ID cookie.
 */
export interface CookieAttributes {
  /**
   * Cookie domain attribute.
   *
   * @remarks
   * If omitted, the browser will scope the cookie to the current host.
   */
  domain?: string

  /**
   * Determines the expiration date of the cookie as the number of days until the cookie expires.
   */
  expires?: number
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
   * @defaultValue `{ views: false, clicks: false, hovers: false }`
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

function resolveDefaultState(
  defaults: CoreStatefulConfig['defaults'] | undefined,
): NonNullable<CoreStatefulConfig['defaults']> {
  const {
    consent = LocalStore.consent,
    profile = LocalStore.profile,
    changes = LocalStore.changes,
    selectedOptimizations = LocalStore.selectedOptimizations,
  } = defaults ?? {}

  return { consent, changes, profile, selectedOptimizations }
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
 * - Web-specific eventBuilder functions (locale, page, user agent),
 * - beacon-based Insights delivery,
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
    api: {
      beaconHandler,
      ...config.api,
    },
    defaults: {
      ...baseDefaults,
      ...defaults,
    },
    eventBuilder: {
      app,
      channel: 'web',
      getLocale,
      getPageProperties,
      getUserAgent,
      ...configuredEventBuilder,
      library: {
        name: OPTIMIZATION_WEB_SDK_NAME,
        version: OPTIMIZATION_WEB_SDK_VERSION,
        ...configuredEventBuilder?.library,
      },
    },
    getAnonymousId: config.getAnonymousId ?? (() => LocalStore.anonymousId),
    logLevel: LocalStore.debug ? 'debug' : logLevel,
  }

  mergedConfig.allowedEventTypes ??= allowedEventTypes ?? ['identify', 'page']

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
  private readonly cookieAttributes?: CookieAttributes = undefined

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
   *   autoTrackEntryInteraction: { views: true },
   * })
   * ```
   */
  constructor(config: OptimizationWebConfig) {
    if (typeof window !== 'undefined' && window.contentfulOptimization)
      throw new Error('ContentfulOptimization is already initialized')

    const { autoTrackEntryInteraction, ...restConfig } = config

    const mergedConfig: OptimizationWebConfig = mergeConfig(restConfig)

    super(mergedConfig)

    const legacyCookieValue = getCookie(ANONYMOUS_ID_COOKIE_LEGACY)
    const cookieValue = legacyCookieValue ?? getCookie(ANONYMOUS_ID_COOKIE)

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
      await this.flush()
    })

    effect(() => {
      const {
        changes: { value },
      } = signals

      LocalStore.changes = value
    })

    effect(() => {
      const {
        consent: { value },
      } = signals

      this.entryInteractionRuntime.syncAutoTrackedEntryInteractions(!!value)
      LocalStore.consent = value
    })

    effect(() => {
      const {
        profile: { value },
      } = signals

      LocalStore.profile = value
      this.setAnonymousId(value?.id)
    })

    effect(() => {
      const {
        selectedOptimizations: { value },
      } = signals

      LocalStore.selectedOptimizations = value
    })

    this.initializeFromCookieValues(cookieValue, legacyCookieValue)

    if (typeof window !== 'undefined') window.contentfulOptimization ??= this
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
   * and ensures SDK state is reset when the persisted anonymous ID differs from the
   * in-memory value.
   *
   * @internal
   */
  private initializeFromCookieValues(cookieValue?: string, legacyCookieValue?: string): void {
    if (legacyCookieValue) removeCookie(ANONYMOUS_ID_COOKIE_LEGACY, this.cookieAttributes)

    if (cookieValue && cookieValue !== LocalStore.anonymousId) {
      this.reset()
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
    this.entryInteractionRuntime.reset()
    removeCookie(ANONYMOUS_ID_COOKIE, this.cookieAttributes)
    LocalStore.reset()
    super.reset()
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
