import type ApiClient from '@contentful/optimization-api-client'
import {
  type ChangeArray,
  type ComponentViewBuilderArgs,
  ComponentViewEvent,
  type EventBuilder,
  type Flags,
  type IdentifyBuilderArgs,
  IdentifyEvent,
  type OptimizationData,
  type PageViewBuilderArgs,
  PageViewEvent,
  type ExperienceEvent as PersonalizationEvent,
  type Profile,
  type SelectedPersonalizationArray,
  type TrackBuilderArgs,
  TrackEvent,
} from '@contentful/optimization-api-client'
import type { Entry } from 'contentful'
import { isEqual } from 'es-toolkit'
import { logger } from 'logger'
import { guardedBy } from '../lib/decorators'
import ProductBase, { type ConsentGuard } from '../ProductBase'
import {
  batch,
  changes as changesSignal,
  consent,
  effect,
  event as eventSignal,
  flags,
  flags as flagsSignal,
  type Observable,
  personalizations,
  personalizations as personalizationsSignal,
  profile,
  profile as profileSignal,
  toObservable,
} from '../signals'
import { PersonalizedEntryResolver } from './resolvers'

export interface PersonalizationConfigDefaults {
  changes?: ChangeArray
  profile?: Profile
  personalizations?: SelectedPersonalizationArray
}

export interface PersonalizationStates {
  flags: Observable<Flags | undefined>
  profile: Observable<Profile | undefined>
  personalizations: Observable<SelectedPersonalizationArray | undefined>
}

class Personalization extends ProductBase<PersonalizationEvent> implements ConsentGuard {
  readonly personalizedEntryResolver = PersonalizedEntryResolver

  readonly states: PersonalizationStates = {
    flags: toObservable(flags),
    profile: toObservable(profile),
    personalizations: toObservable(personalizations),
  }

  constructor(api: ApiClient, builder: EventBuilder, defaults?: PersonalizationConfigDefaults) {
    super(api, builder)

    if (defaults) {
      const {
        changes: defaultChanges,
        personalizations: defaultPersonalizations,
        profile: defaultProfile,
      } = defaults

      batch(() => {
        changesSignal.value = defaultChanges
        personalizationsSignal.value = defaultPersonalizations
        profileSignal.value = defaultProfile
      })
    }

    effect(() => {
      logger.info(
        `[Personalization] Profile ${profileSignal.value && `with ID ${profileSignal.value.id}`} has been ${profileSignal.value ? 'set' : 'cleared'}`,
      )
    })

    effect(() => {
      logger.info(
        `[Personalization] Variants have been ${personalizationsSignal.value?.length ? 'populated' : 'cleared'}`,
      )
    })

    effect(() => {
      logger.info(
        `[Personalization] Personalization ${consent.value ? 'will' : 'will not'} take effect due to consent (${consent.value})`,
      )
    })
  }

  get flags(): Flags | undefined {
    return flagsSignal.value
  }

  reset(): void {
    batch(() => {
      changesSignal.value = undefined
      profileSignal.value = undefined
      personalizationsSignal.value = undefined
    })
  }

  personalizeEntry(entry: Entry): Entry {
    return PersonalizedEntryResolver.resolve(entry)
  }

  onBlockedByConsent(name: string, args: unknown[]): void {
    logger.warn(
      `[Personalization] Event "${name}" was blocked due to lack of consent; args: ${JSON.stringify(args)}`,
    )
  }

  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async identify(args: IdentifyBuilderArgs): Promise<OptimizationData | undefined> {
    logger.info('[Personalization] Sending "identify" event')

    const event = IdentifyEvent.parse(this.builder.buildIdentify(args))

    return await this.#upsertProfile(event)
  }

  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async page(args: PageViewBuilderArgs = {}): Promise<OptimizationData> {
    logger.info('[Personalization] Sending "page" event')

    const event = PageViewEvent.parse(this.builder.buildPageView(args))

    return await this.#upsertProfile(event)
  }

  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async track(args: TrackBuilderArgs): Promise<OptimizationData> {
    logger.info(`[Personalization] Sending "track" event "${args.event}"`)

    const event = TrackEvent.parse(this.builder.buildTrack(args))

    return await this.#upsertProfile(event)
  }

  /** AKA sticky component view */
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackPersonalization(args: ComponentViewBuilderArgs): Promise<OptimizationData> {
    logger.info(`[Personalization] Sending "track personalization" event`)

    const event = ComponentViewEvent.parse(this.builder.buildComponentView(args))

    return await this.#upsertProfile(event)
  }

  async #upsertProfile(event: PersonalizationEvent): Promise<OptimizationData> {
    const intercepted = await this.interceptor.event.run(event)

    eventSignal.value = intercepted

    const anonymousId = this.builder.getAnonymousId()

    const data = await this.api.experience.upsertProfile({
      profileId: anonymousId ?? profileSignal.value?.id,
      events: [intercepted],
    })

    await this.#updateOutputSignals(data)

    return data
  }

  async #updateOutputSignals(data: OptimizationData): Promise<void> {
    const intercepted = await this.interceptor.state.run(data)

    const { changes, personalizations, profile } = intercepted

    batch(() => {
      if (!isEqual(changesSignal.value, changes)) changesSignal.value = changes
      if (!isEqual(profileSignal.value, profile)) profileSignal.value = profile
      if (!isEqual(personalizationsSignal.value, personalizations))
        personalizationsSignal.value = personalizations
    })
  }
}

export default Personalization
