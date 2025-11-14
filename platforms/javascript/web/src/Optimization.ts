import {
  type App,
  type CoreConfig,
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
import { beaconHandler } from './beacon'
import { getAnonymousId, getLocale, getPageProperties, getUserAgent } from './builders'
import { ANONYMOUS_ID_COOKIE } from './global-constants'
import {
  ElementExistenceObserver,
  type ElementViewElementOptions,
  ElementViewObserver,
} from './observers'
import { LocalStore } from './storage'

declare global {
  interface Window {
    Optimization?: typeof Optimization
    optimization?: Optimization
  }
}

export interface OptimizationWebConfig extends CoreStatefulConfig {
  app?: App
  autoTrackEntryViews?: boolean
  autoObserveEntryElements?: boolean
}

function mergeConfig({
  app,
  defaults,
  logLevel,
  ...config
}: OptimizationWebConfig): CoreStatefulConfig {
  const {
    consent = LocalStore.consent,
    analytics: { profile: analyticsProfile = LocalStore.profile } = {},
    personalization: {
      changes = LocalStore.changes,
      profile: personalizationProfile = LocalStore.profile,
      personalizations = LocalStore.personalizations,
    } = {},
  } = defaults ?? {}

  return merge(
    {
      api: {
        analytics: { beaconHandler },
      },
      defaults: {
        consent,
        analytics: {
          profile: analyticsProfile,
        },
        personalization: {
          changes,
          profile: personalizationProfile,
          personalizations,
        },
      },
      eventBuilder: {
        app,
        channel: 'web',
        library: { name: 'Optimization Web API', version: '0.0.0' },
        getAnonymousId,
        getLocale,
        getPageProperties,
        getUserAgent,
      },
      logLevel: LocalStore.debug ? 'debug' : logLevel,
    },
    config,
  )
}

class Optimization extends CoreStateful {
  #elementViewObserver?: ElementViewObserver = undefined
  #elementExistenceObserver?: ElementExistenceObserver = undefined

  autoObserveEntryElements = false
  autoTrackEntryViews = false

  constructor(config: OptimizationWebConfig) {
    if (window.optimization) throw new Error('Optimization is already initialized')

    const { autoObserveEntryElements, autoTrackEntryViews, ...restConfig } = config

    const mergedConfig: CoreConfig = mergeConfig(restConfig)

    super(mergedConfig)

    this.autoObserveEntryElements = autoObserveEntryElements ?? false
    this.autoTrackEntryViews = autoTrackEntryViews ?? false

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

      const cookieValue = Cookies.get(ANONYMOUS_ID_COOKIE)

      LocalStore.anonymousId = value?.id ?? cookieValue

      // TODO: Allow cookie attributes to be set
      if (value && value.id !== cookieValue) Cookies.set(ANONYMOUS_ID_COOKIE, value.id)
    })

    effect(() => {
      const {
        personalizations: { value },
      } = signals

      LocalStore.personalizations = value
    })
  }

  startAutoTrackingEntryViews(options?: ElementViewElementOptions): void {
    this.#elementViewObserver = new ElementViewObserver(
      createAutoTrackingEntryViewCallback({
        personalization: this.personalization,
        analytics: this.analytics,
      }),
    )

    this.#elementExistenceObserver = new ElementExistenceObserver(
      createAutoTrackingEntryExistenceCallback(
        this.#elementViewObserver,
        this.autoObserveEntryElements,
      ),
    )

    if (!this.autoObserveEntryElements) return

    // Fully-automated observation for elements with ctfl data attributes
    const entries = document.querySelectorAll('[data-ctfl-entry-id]')

    entries.forEach((element) => {
      if (!isEntryElement(element)) return

      logger.info('[Optimization Web SDK] Auto-observing element (init):', element)

      this.#elementViewObserver?.observe(element, {
        ...options,
      })
    })
  }

  trackEntryViewForElement(element: Element, options?: ElementViewElementOptions): void {
    logger.info('[Optimization Web SDK] Manually observing element:', element)
    this.#elementViewObserver?.observe(element, options)
  }

  untrackEntryViewForElement(element: Element): void {
    logger.info('[Optimization Web SDK] Manually unobserving element:', element)
    this.#elementViewObserver?.unobserve(element)
  }

  stopAutoTrackingEntryViews(): void {
    this.#elementExistenceObserver?.disconnect()
    this.#elementViewObserver?.disconnect()
  }

  reset(): void {
    this.stopAutoTrackingEntryViews()
    Cookies.remove(ANONYMOUS_ID_COOKIE)
    LocalStore.reset()
    super.reset()
  }
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- protect against non-Web
if (window) window.Optimization ??= Optimization

export default Optimization
