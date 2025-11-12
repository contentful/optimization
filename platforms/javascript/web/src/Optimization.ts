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
import { beaconHandler } from './beacon'
import { getAnonymousId, getLocale, getPageProperties, getUserAgent } from './builders'
import { ANONYMOUS_ID_COOKIE } from './global-constants'
import {
  ElementExistenceObserver,
  type ElementViewCallbackInfo,
  type ElementViewElementOptions,
  ElementViewObserver,
  type ElementViewOptions,
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
  elementViewObserveOptions?: ElementViewOptions
}

export type CtflDataset = DOMStringMap & {
  ctflEntryId: string
  ctflDuplicationScope?: string
  ctflPersonalizationId?: string
  ctflSticky?: 'true' | 'false'
  ctflVariantIndex?: string
}

export type EntryElement = (HTMLElement | SVGElement) & { dataset: CtflDataset }

// This does not support legacy browsers that don't support `dataset` on `SVGElement`
export function isEntryElement(element: Element): element is EntryElement {
  const isWeb = typeof HTMLElement !== 'undefined' && typeof SVGElement !== 'undefined'

  if (!isWeb || element.nodeType !== 1) return false

  if (!('dataset' in element)) return false

  if (!element.dataset || typeof element.dataset !== 'object') return false

  if (!('ctflEntryId' in element.dataset)) return false

  const {
    dataset: { ctflEntryId },
  } = element

  return typeof ctflEntryId === 'string' && ctflEntryId.trim().length > 0
}

export interface EntryData {
  duplicationScope?: string
  entryId: string
  personalizationId?: string
  sticky?: boolean
  variantIndex?: number
}

export function isEntryData(data?: unknown): data is EntryData {
  if (!data) return false
  if (typeof data !== 'object') return false
  return 'entryId' in data && typeof data.entryId === 'string' && !!data.entryId.trim().length
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

function parseSticky(sticky: string | undefined): boolean {
  return (sticky?.trim().toLowerCase() ?? '') === 'true'
}

// Only non-negative integers allowed
function parseVariantIndex(variantIndex: string | undefined): number | undefined {
  if (variantIndex === undefined || !/^\d+$/.test(variantIndex)) return undefined
  const n = Number(variantIndex)
  return Number.isSafeInteger(n) ? n : undefined
}

class Optimization extends CoreStateful {
  readonly #elementViewObserver: ElementViewObserver
  readonly #elementExistenceObserver: ElementExistenceObserver

  constructor(config: OptimizationWebConfig) {
    if (window.optimization) throw new Error('Optimization is already initialized')

    const { elementViewObserveOptions: entryViewObserveOptions, ...restConfig } = config

    const mergedConfig: CoreConfig = mergeConfig(restConfig)

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

    this.#elementViewObserver = new ElementViewObserver(
      async (element: Element, info: ElementViewCallbackInfo) => {
        if (!isEntryData(info.data) && !isEntryElement(element)) return

        let duplicationScope: string | undefined = undefined
        let entryId: string | undefined = undefined
        let personalizationId: string | undefined = undefined
        let sticky: boolean | undefined = undefined
        let variantIndex: number | undefined = undefined

        if (isEntryData(info.data)) {
          ;({
            data: { duplicationScope, entryId, personalizationId, sticky, variantIndex },
          } = info)
        } else if (isEntryElement(element)) {
          ;({
            dataset: {
              ctflDuplicationScope: duplicationScope,
              ctflEntryId: entryId,
              ctflPersonalizationId: personalizationId,
            },
          } = element)

          const {
            dataset: { ctflSticky, ctflVariantIndex },
          } = element

          sticky = parseSticky(ctflSticky)
          variantIndex = parseVariantIndex(ctflVariantIndex)
        }

        if (!entryId) {
          logger.warn(
            '[Element View Observer Callback] No entry data found; please add data attributes or observe with data info',
          )
          return
        }

        if (sticky)
          await this.personalization.trackComponentView(
            {
              componentId: entryId,
              experienceId: personalizationId,
              variantIndex,
            },
            duplicationScope,
          )

        await this.analytics.trackComponentView(
          {
            componentId: entryId,
            experienceId: personalizationId,
            variantIndex,
          },
          duplicationScope,
        )
      },
    )

    this.#elementExistenceObserver = new ElementExistenceObserver({
      onRemoved: (elements: readonly Element[]): void => {
        elements.forEach((element) => {
          if (!this.#elementViewObserver.getStats(element)) return

          logger.info('[Optimization Web SDK] Auto-removing element:', element)
          this.#elementViewObserver.unobserve(element)
        })
      },
      onAdded: (elements: readonly Element[]): void => {
        elements.forEach((element) => {
          if (!isEntryElement(element)) return

          logger.info('[Optimization Web SDK] Auto-observing element:', element)
          this.#elementViewObserver.observe(element)
        })
      },
    })

    window.optimization = this
  }

  autoTrackEntryViews(options?: ElementViewElementOptions): void {
    const entries = document.querySelectorAll('[data-ctfl-entry-id]')

    entries.forEach((element) => {
      if (!isEntryElement(element)) return

      logger.info('[Optimization Web SDK] Auto-observing element (init):', element)
      this.#elementViewObserver.observe(element, {
        ...options,
      })
    })
  }

  disconnectAutoTrackEntryViews(): void {
    this.#elementExistenceObserver.disconnect()
    this.#elementViewObserver.disconnect()
  }
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- protect against non-Web
if (window) window.Optimization ??= Optimization

export default Optimization
