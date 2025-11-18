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
  batch,
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
  private readonly queue = new Map<Profile, InsightsEventArray>()

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

  reset(): void {
    batch(() => {
      eventSignal.value = undefined
      profileSignal.value = undefined
    })
  }

  hasConsent(name: string): boolean {
    if (name === 'trackComponentView') name = 'component'

    return !!consent.value || (this.allowedEventTypes ?? []).includes(name)
  }

  onBlockedByConsent(name: string, args: unknown[]): void {
    logger.warn(
      `[Anaylytics] Event "${name}" was blocked due to lack of consent; args: ${JSON.stringify(args)}`,
    )
  }

  isNotDuplicated(_name: string, args: [ComponentViewBuilderArgs, string]): boolean {
    const [{ componentId: value }, duplicationKey] = args

    const isDuplicated = this.duplicationDetector.isPresent(duplicationKey, value)

    if (!isDuplicated) this.duplicationDetector.addValue(duplicationKey, value)

    return !isDuplicated
  }

  onBlockedByDuplication(name: string, args: unknown[]): void {
    const componentType = name === 'trackFlagView' ? 'flag' : 'component'

    logger.info(
      `[Analytics] Duplicate "${componentType} view" event detected, skipping; args: ${JSON.stringify(args)}`,
    )
  }

  @guardedBy('isNotDuplicated', { onBlocked: 'onBlockedByDuplication' })
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackComponentView(payload: ComponentViewBuilderArgs, _duplicationKey = ''): Promise<void> {
    logger.info(`[Analytics] Processing "component view" event for`, payload.componentId)

    await this.enqueueEvent(this.builder.buildComponentView(payload))
  }

  @guardedBy('isNotDuplicated', { onBlocked: 'onBlockedByDuplication' })
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackFlagView(payload: ComponentViewBuilderArgs, _duplicationKey = ''): Promise<void> {
    logger.debug(`[Analytics] Processing "flag view" event for`, payload.componentId)

    await this.enqueueEvent(this.builder.buildFlagView(payload))
  }

  private async enqueueEvent(event: InsightsEvent): Promise<void> {
    const { value: profile } = profileSignal

    if (!profile) {
      logger.warn('Attempting to emit an event without an Optimization profile')

      return
    }

    const intercepted = await this.interceptor.event.run(event)

    const validEvent = InsightsEvent.parse(intercepted)

    logger.debug(`Queueing ${event.type} event for profile ${profile.id}`, event)

    const profileEventQueue = this.queue.get(profile)

    eventSignal.value = validEvent

    if (profileEventQueue) {
      profileEventQueue.push(validEvent)
    } else {
      this.queue.set(profile, [validEvent])
    }

    await this.flushMaxEvents()
  }

  private async flushMaxEvents(): Promise<void> {
    if (this.queue.values().toArray().flat().length >= MAX_QUEUED_EVENTS) await this.flush()
  }

  async flush(): Promise<void> {
    logger.debug(`[Analytics] Flushing event queue`)

    const batches: BatchInsightsEventArray = []

    this.queue.forEach((events, profile) => batches.push({ profile, events }))

    await this.api.insights.sendBatchEvents(batches)

    this.queue.clear()
  }
}

export default AnalyticsStateful
