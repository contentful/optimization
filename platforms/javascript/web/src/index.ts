import {
  ANONYMOUS_ID_COOKIE,
  type App,
  type CoreConfig,
  CoreStateful,
  type CoreStatefulConfig,
  effect,
  signals,
} from '@contentful/optimization-core'
import { merge } from 'es-toolkit'
import Cookies from 'js-cookie'
import { beaconHandler } from './beacon/beaconHandler'
import { getAnonymousId, getLocale, getPageProperties, getUserAgent } from './builders/EventBuilder'
import LocalStore from './storage/LocalStore'
export { ANONYMOUS_ID } from './storage/LocalStore'

declare global {
  interface Window {
    Optimization?: typeof Optimization
    optimization?: Optimization
  }
}

export interface OptimizationWebConfig extends CoreStatefulConfig {
  app?: App
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
  constructor(config: OptimizationWebConfig) {
    if (window.optimization) throw new Error('Optimization is already initialized')

    const mergedConfig: CoreConfig = mergeConfig(config)

    super(mergedConfig)

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

    window.optimization = this
  }
}

window.Optimization ??= Optimization

export default Optimization
