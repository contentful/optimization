/**
 * Web SDK entrypoint for Contentful Optimization.
 *
 * @packageDocumentation
 * @remarks
 * Exposes a browser-wired {@link Optimization} class built on top of {@link CoreStateful}.
 * When executed in a browser environment, the constructor attaches a singleton instance
 * to `window.optimization` and the class constructor to `window.Optimization` for
 * script-tag / global usage.
 */

import {
  ANONYMOUS_ID_COOKIE_LEGACY,
  type App,
  CoreStateful,
  type CoreStatefulConfig,
  createScopedLogger,
  effect,
  signals,
} from '@contentful/optimization-core'
import { merge } from 'es-toolkit'
import Cookies from 'js-cookie'
import {
  createAutoTrackingEntryExistenceCallback,
  createAutoTrackingEntryViewCallback,
  isEntryElement,
} from './AutoEntryViewTracking'
import { getLocale, getPageProperties, getUserAgent } from './builders'
import { ANONYMOUS_ID_COOKIE, OPTIMIZATION_WEB_SDK_VERSION } from './global-constants'
import {
  beaconHandler,
  createOnlineChangeListener,
  createVisibilityChangeListener,
} from './handlers'
import {
  ElementExistenceObserver,
  type ElementViewElementOptions,
  ElementViewObserver,
  type ElementViewObserverOptions,
} from './observers'
import { LocalStore } from './storage'

/**
 * Scoped logger used by the Web SDK.
 *
 * @internal
 */
const logger = createScopedLogger('Web:SDK')

declare global {
  interface Window {
    /** Global Optimization class constructor attached by the Web SDK. */
    Optimization?: typeof Optimization
    /** Singleton instance created by the Web SDK initializer. */
    optimization?: Optimization
  }
}

/**
 * Supported cookie attributes for the Web SDK.
 *
 * @public
 * @remarks
 * These options are passed to {@link Cookies.set} when persisting the anonymous ID.
 */
interface CookieAttributes {
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
 * Configuration options for the Optimization Web SDK.
 *
 * @public
 * @remarks
 * Extends {@link CoreStatefulConfig} with Web-specific options such as the
 * application descriptor and automatic entry view tracking.
 */
export interface OptimizationWebConfig extends CoreStatefulConfig {
  /**
   * Application metadata used to identify the Web app in downstream events.
   */
  app?: App

  /**
   * Whether the SDK should automatically track entry views based on DOM
   * attributes and observers.
   *
   * @defaultValue `false`
   */
  autoTrackEntryViews?: boolean

  /**
   * Cookie configuration used for persisting the anonymous identifier.
   *
   * @remarks
   * Use this to control the cookie domain and expiration.
   */
  cookie?: CookieAttributes
}

/**
 * Merge user-supplied Web configuration with sensible defaults for the
 * stateful core and browser environment.
 *
 * @param config - Incoming Web SDK configuration.
 * @returns A fully composed {@link CoreStatefulConfig} object.
 *
 * @internal
 * @remarks
 * This helper wires together:
 * - consent/profile/personalizations from LocalStore,
 * - Web-specific eventBuilder functions (locale, page, user agent),
 * - beacon-based analytics flushing,
 * - and anonymous ID retrieval.
 */
function mergeConfig({
  app,
  defaults,
  logLevel,
  ...config
}: OptimizationWebConfig): CoreStatefulConfig {
  const {
    consent = LocalStore.consent,
    profile = LocalStore.profile,
    changes = LocalStore.changes,
    personalizations = LocalStore.personalizations,
  } = defaults ?? {}

  return merge(
    {
      analytics: { beaconHandler },
      defaults: {
        consent,
        changes,
        profile,
        personalizations,
      },
      eventBuilder: {
        app,
        channel: 'web',
        library: { name: 'Optimization Web API', version: OPTIMIZATION_WEB_SDK_VERSION },
        getLocale,
        getPageProperties,
        getUserAgent,
      },
      getAnonymousId: () => LocalStore.anonymousId,
      logLevel: LocalStore.debug ? 'debug' : logLevel,
    },
    config,
  )
}

/**
 * Stateful Web SDK built on top of {@link CoreStateful}.
 *
 * @public
 * @remarks
 * Provides browser-specific wiring:
 * - automatic persistence of consent, profile, and personalizations,
 * - cookie-based anonymous ID handling,
 * - automatic entry view tracking via IntersectionObserver and MutationObserver,
 * - online-change based flushing of events,
 * - and visibility-change based flushing of events.
 *
 * A singleton instance is attached to `window.optimization` when constructed
 * in a browser environment.
 */
class Optimization extends CoreStateful {
  /**
   * Observer responsible for element view/dwell-time tracking.
   *
   * @internal
   */
  private elementViewObserver?: ElementViewObserver = undefined

  /**
   * Observer responsible for detecting entry elements added/removed in the DOM.
   *
   * @internal
   */
  private elementExistenceObserver?: ElementExistenceObserver = undefined

  /**
   * Whether automatic entry view tracking is enabled.
   *
   * @internal
   */
  private autoTrackEntryViews = false

  /**
   * Cookie attributes used when persisting the anonymous identifier.
   *
   * @internal
   */
  private readonly cookieAttributes?: CookieAttributes = undefined

  /**
   * Create a new Optimization Web SDK instance.
   *
   * @param config - Web SDK configuration.
   *
   * @throws If an `Optimization` instance has already been initialized on
   * `window.optimization`.
   *
   * @example
   * ```ts
   * import Optimization from '@contentful/optimization-web'
   *
   * const optimization = new Optimization({
   *   clientId: 'abc-123',
   *   environment: 'main',
   *   autoTrackEntryViews: true,
   * })
   * ```
   */
  constructor(config: OptimizationWebConfig) {
    if (typeof window !== 'undefined' && window.optimization)
      throw new Error('Optimization is already initialized')

    const { autoTrackEntryViews, ...restConfig } = config

    const mergedConfig: OptimizationWebConfig = mergeConfig(restConfig)

    super(mergedConfig)

    const legacyCookieValue = Cookies.get(ANONYMOUS_ID_COOKIE_LEGACY)
    const cookieValue = legacyCookieValue ?? Cookies.get(ANONYMOUS_ID_COOKIE)

    this.autoTrackEntryViews = true

    this.cookieAttributes = {
      domain: mergedConfig.cookie?.domain,
      expires: mergedConfig.cookie?.expires ?? EXPIRATION_DAYS_DEFAULT,
    }

    createOnlineChangeListener((isOnline) => {
      this.online(isOnline)
    })

    createVisibilityChangeListener(async () => {
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

      if (this.autoTrackEntryViews) {
        value ? this.startAutoTrackingEntryViews() : this.stopAutoTrackingEntryViews()
      }

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
        personalizations: { value },
      } = signals

      LocalStore.personalizations = value
    })

    this.initializeFromCookieValues(cookieValue, legacyCookieValue)

    if (typeof window !== 'undefined') window.optimization ??= this
  }

  /**
   * Initialize anonymous ID state from cookies.
   *
   * @internal
   * @remarks
   * Reads the legacy anonymous ID cookie (if present), migrates to the current cookie,
   * and ensures SDK state is reset when the persisted anonymous ID differs from the
   * in-memory value.
   */
  private initializeFromCookieValues(cookieValue?: string, legacyCookieValue?: string): void {
    if (legacyCookieValue) Cookies.remove(ANONYMOUS_ID_COOKIE_LEGACY)

    if (cookieValue && cookieValue !== LocalStore.anonymousId) {
      this.reset()
      this.setAnonymousId(cookieValue)
    }
  }

  /**
   * Persist (or clear) the anonymous ID in both cookies and {@link LocalStore}.
   *
   * @param value - Anonymous identifier to persist. If omitted, clears persisted state.
   *
   * @internal
   */
  private setAnonymousId(value?: string): void {
    if (!value) {
      Cookies.remove(ANONYMOUS_ID_COOKIE)
      LocalStore.anonymousId = undefined
      return
    }
    Cookies.set(ANONYMOUS_ID_COOKIE, value, this.cookieAttributes)
    LocalStore.anonymousId = value
  }

  /**
   * Enable automatic entry view tracking for elements with `data-ctfl-*`
   * attributes and start observing the document.
   *
   * @param options - Optional per-element observer defaults for dwell time,
   *   retries, and backoff behavior.
   *
   * @example
   * ```ts
   * optimization.startAutoTrackingEntryViews({ dwellTimeMs: 1000 })
   * ```
   */
  startAutoTrackingEntryViews(options?: ElementViewObserverOptions): void {
    this.autoTrackEntryViews = true

    this.elementViewObserver = new ElementViewObserver(createAutoTrackingEntryViewCallback(this))

    this.elementExistenceObserver = new ElementExistenceObserver(
      createAutoTrackingEntryExistenceCallback(this.elementViewObserver, true),
    )

    // Fully-automated observation for elements with ctfl data attributes
    const entries = document.querySelectorAll('[data-ctfl-entry-id]')

    entries.forEach((element) => {
      if (!isEntryElement(element)) return

      logger.info('Auto-observing element (init):', element)

      this.elementViewObserver?.observe(element, {
        ...options,
      })
    })
  }

  /**
   * Disable automatic entry view tracking and disconnect underlying observers.
   *
   * @example
   * ```ts
   * optimization.stopAutoTrackingEntryViews()
   * ```
   */
  stopAutoTrackingEntryViews(): void {
    this.elementExistenceObserver?.disconnect()
    this.elementViewObserver?.disconnect()
  }

  /**
   * Begin tracking entry views for a specific element, using the Web SDK’s
   * dwell-time and retry logic.
   *
   * @param element - Element to observe.
   * @param options - Per-element observer options and callback data.
   *
   * @remarks
   * This method relies on an initialized {@link ElementViewObserver}. If automatic
   * tracking has not been started, the call is a no-op.
   *
   * @example
   * ```ts
   * const element = document.querySelector('#hero')!
   * optimization.trackEntryViewForElement(element, {
   *   dwellTimeMs: 1500,
   *   data: { entryId: 'xyz' },
   * })
   * ```
   */
  trackEntryViewForElement(element: Element, options: ElementViewElementOptions): void {
    logger.info('Manually observing element:', element)
    this.elementViewObserver?.observe(element, options)
  }

  /**
   * Stop tracking entry views for a specific element.
   *
   * @param element - Element to stop observing.
   *
   * @remarks
   * This method relies on an initialized {@link ElementViewObserver}. If automatic
   * tracking has not been started, the call is a no-op.
   *
   * @example
   * ```ts
   * optimization.untrackEntryViewForElement(element)
   * ```
   */
  untrackEntryViewForElement(element: Element): void {
    logger.info('Manually unobserving element:', element)
    this.elementViewObserver?.unobserve(element)
  }

  /**
   * Reset all Web SDK state:
   * - stops auto-tracking entry views,
   * - clears the anonymous ID cookie,
   * - clears LocalStore caches,
   * - and delegates to {@link CoreStateful.reset} for underlying state reset.
   *
   * @example
   * ```ts
   * optimization.reset()
   * ```
   */
  reset(): void {
    this.stopAutoTrackingEntryViews()
    Cookies.remove(ANONYMOUS_ID_COOKIE)
    LocalStore.reset()
    super.reset()
  }
}

/**
 * Attach the class constructor to the global `window` object in browsers.
 *
 * @internal
 */
if (typeof window !== 'undefined') window.Optimization ??= Optimization

export default Optimization
