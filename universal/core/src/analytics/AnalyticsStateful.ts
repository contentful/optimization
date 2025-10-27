import type ApiClient from '@contentful/optimization-api-client'
import {
  InsightsEvent,
  type BatchInsightsEventArray,
  type ComponentViewBuilderArgs,
  type EventBuilder,
  type InsightsEventArray,
  type Profile,
} from '@contentful/optimization-api-client'
import { logger } from 'logger'
import type { ConsentGuard } from '../Consent'
import { guardedBy } from '../lib/decorators'
import type { ProductConfig } from '../ProductBase'
import {
  consent,
  effect,
  event as eventSignal,
  profile as profileSignal,
  toObservable,
  type Observable,
} from '../signals'
import AnalyticsBase from './AnalyticsBase'

export interface AnalyticsProductConfigDefaults {
  consent?: boolean
  profile?: Profile
}

export interface AnalyticsProductConfig extends ProductConfig {
  defaults?: AnalyticsProductConfigDefaults
}

export interface AnalyticsStates {
  profile: Observable<Profile | undefined>
}

const MAX_QUEUED_EVENTS = 25

class AnalyticsStateful extends AnalyticsBase implements ConsentGuard {
  readonly #queue = new Map<Profile, InsightsEventArray>()

  readonly states: AnalyticsStates = {
    profile: toObservable(profileSignal),
  }

  constructor(api: ApiClient, builder: EventBuilder, config?: AnalyticsProductConfig) {
    super(api, builder, config)

    const { defaults } = config ?? {}

    if (defaults?.profile !== undefined) {
      const { profile: defaultProfile } = defaults
      profileSignal.value = defaultProfile
    }

    effect(() => {
      const id = profileSignal.value?.id

      logger.info(
        `[Analytics] Analytics ${consent.value ? 'will' : 'will not'} be collected due to consent (${consent.value})`,
      )

      logger.info(`[Analytics] Profile ${id && `with ID ${id}`} has been ${id ? 'set' : 'cleared'}`)
    })
  }

  hasConsent(name: string): boolean {
    if (name === 'trackComponentView') name = 'component'

    return !!consent.value || (this.allowedEvents ?? []).includes(name)
  }

  onBlockedByConsent(name: string, args: unknown[]): void {
    logger.warn(
      `[Anaylytics] Event "${name}" was blocked due to lack of consent; args: ${JSON.stringify(args)}`,
    )
  }

  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackComponentView(args: ComponentViewBuilderArgs): Promise<void> {
    logger.info(`[Analytics] Processing "component view" event`)

    await this.#enqueueEvent(this.builder.buildComponentView(args))
  }

  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackFlagView(args: ComponentViewBuilderArgs): Promise<void> {
    logger.debug(`[Analytics] Processing "flag view" event`)

    await this.#enqueueEvent(this.builder.buildFlagView(args))
  }

  async #enqueueEvent(event: InsightsEvent): Promise<void> {
    const { value: profile } = profileSignal

    if (!profile) {
      logger.warn('Attempting to emit an event without an Optimization profile')

      return
    }

    const intercepted = await this.interceptor.event.run(event)

    const validEvent = InsightsEvent.parse(intercepted)

    logger.debug(`Queueing ${event.type} event for profile ${profile.id}`, event)

    const profileEventQueue = this.#queue.get(profile)

    eventSignal.value = validEvent

    if (profileEventQueue) {
      profileEventQueue.push(validEvent)
    } else {
      this.#queue.set(profile, [validEvent])
    }

    await this.#flushMaxEvents()
  }

  async #flushMaxEvents(): Promise<void> {
    if (this.#queue.values().toArray().flat().length >= MAX_QUEUED_EVENTS) await this.flush()
  }

  async flush(): Promise<void> {
    logger.debug(`[Analytics] Flushing event queue`)

    const batches: BatchInsightsEventArray = []

    this.#queue.forEach((events, profile) => batches.push({ profile, events }))

    await this.api.insights.sendBatchEvents(batches)

    this.#queue.clear()
  }
}

export default AnalyticsStateful
