import {
  type App,
  CoreStateful,
  type CoreStatefulConfig,
  effect,
  logger,
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
import { ANONYMOUS_ID_COOKIE } from './global-constants'
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

declare global {
  interface Window {
    /** Global Optimization class constructor attached by the Web SDK. */
    Optimization?: typeof Optimization
    /** Singleton instance created by the Web SDK initializer. */
    optimization?: Optimization
  }
}

interface CookieAttributes {
  domain?: string
  /**
   * Determines the expiration date of the cookie as the number of days until the cookie expires.
   */
  expires?: number
}

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
        library: { name: 'Optimization Web API', version: '0.0.0' },
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
  private elementViewObserver?: ElementViewObserver = undefined
  private elementExistenceObserver?: ElementExistenceObserver = undefined
  private autoTrackEntryViews = false
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

    const cookieValue = Cookies.get(ANONYMOUS_ID_COOKIE)

    this.cookieAttributes = {
      domain: mergedConfig.cookie?.domain,
      expires: mergedConfig.cookie?.expires ?? EXPIRATION_DAYS_DEFAULT,
    }

    this.autoTrackEntryViews = true

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

    if (cookieValue && cookieValue !== LocalStore.anonymousId) {
      this.reset()
      this.setAnonymousId(cookieValue)
    }

    if (typeof window !== 'undefined') window.optimization ??= this
  }

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

      logger.info('[Optimization Web SDK] Auto-observing element (init):', element)

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
    logger.info('[Optimization Web SDK] Manually observing element:', element)
    this.elementViewObserver?.observe(element, options)
  }

  /**
   * Stop tracking entry views for a specific element.
   *
   * @param element - Element to stop observing.
   *
   * @example
   * ```ts
   * optimization.untrackEntryViewForElement(element)
   * ```
   */
  untrackEntryViewForElement(element: Element): void {
    logger.info('[Optimization Web SDK] Manually unobserving element:', element)
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

if (typeof window !== 'undefined') window.Optimization ??= Optimization

export default Optimization
