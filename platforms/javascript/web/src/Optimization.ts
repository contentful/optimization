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
import { getLocale, getPageProperties, getUserAgent } from './builders'
import { ANONYMOUS_ID_COOKIE } from './global-constants'
import { beaconHandler, createVisibilityChangeListener } from './handlers'
import {
  ElementExistenceObserver,
  type ElementViewElementOptions,
  ElementViewObserver,
  type ElementViewObserverOptions,
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
      analytics: { beaconHandler },
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

class Optimization extends CoreStateful {
  private elementViewObserver?: ElementViewObserver = undefined
  private elementExistenceObserver?: ElementExistenceObserver = undefined

  private autoTrackEntryViews = false

  constructor(config: OptimizationWebConfig) {
    if (typeof window !== 'undefined' && window.optimization)
      throw new Error('Optimization is already initialized')

    const { autoTrackEntryViews, ...restConfig } = config

    const mergedConfig: CoreConfig = mergeConfig(restConfig)

    super(mergedConfig)

    this.autoTrackEntryViews = true

    createVisibilityChangeListener(async () => {
      await this.analytics.flush()
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

      const cookieValue = Cookies.get(ANONYMOUS_ID_COOKIE)

      LocalStore.anonymousId = value?.id ?? cookieValue

      if (value && value.id !== cookieValue) Cookies.set(ANONYMOUS_ID_COOKIE, value.id)
    })

    effect(() => {
      const {
        personalizations: { value },
      } = signals

      LocalStore.personalizations = value
    })

    if (typeof window !== 'undefined') window.optimization ??= this
  }

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

  stopAutoTrackingEntryViews(): void {
    this.elementExistenceObserver?.disconnect()
    this.elementViewObserver?.disconnect()
  }

  trackEntryViewForElement(element: Element, options?: ElementViewElementOptions): void {
    logger.info('[Optimization Web SDK] Manually observing element:', element)
    this.elementViewObserver?.observe(element, options)
  }

  untrackEntryViewForElement(element: Element): void {
    logger.info('[Optimization Web SDK] Manually unobserving element:', element)
    this.elementViewObserver?.unobserve(element)
  }

  reset(): void {
    this.stopAutoTrackingEntryViews()
    Cookies.remove(ANONYMOUS_ID_COOKIE)
    LocalStore.reset()
    super.reset()
  }
}

if (typeof window !== 'undefined') window.Optimization ??= Optimization

export default Optimization
