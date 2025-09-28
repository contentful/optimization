import {
  ANONYMOUS_ID_COOKIE,
  type CoreConfig,
  CoreStateful,
  effect,
  signals,
} from '@contentful/optimization-core'
import { merge } from 'es-toolkit'
import Cookies from 'js-cookie'
import { beaconHandler } from './beacon/beaconHandler'
import { getLocale, getPageProperties, getUserAgent } from './builders/EventBuilder'
import LocalStore from './storage/LocalStore'

declare global {
  interface Window {
    Optimization?: typeof Optimization
    optimization?: Optimization
  }
}

function mergeConfig({ defaults, logLevel, ...config }: CoreConfig): CoreConfig {
  return merge(
    {
      api: {
        analytics: { beaconHandler },
      },
      defaults: {
        changes: LocalStore.changes ?? defaults?.changes,
        consent: LocalStore.consent ?? defaults?.consent,
        profile: LocalStore.profile ?? defaults?.profile,
        variants: LocalStore.variants ?? defaults?.variants,
      },
      eventBuilder: {
        channel: 'web',
        library: { name: 'Optimization Web API', version: '0.0.0' },
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
  constructor(config: CoreConfig) {
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
        variants: { value },
      } = signals

      LocalStore.variants = value
    })

    window.optimization = this
  }
}

window.Optimization ??= Optimization

export default Optimization
