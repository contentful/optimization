import type ApiClient from '@contentful/optimization-api-client'
import {
  type ChangeArray,
  type ComponentViewBuilderArgs,
  ComponentViewEvent,
  type EventBuilder,
  type Flags,
  type IdentifyBuilderArgs,
  IdentifyEvent,
  type MergeTagEntry,
  type OptimizationData,
  type PageViewBuilderArgs,
  PageViewEvent,
  type ExperienceEvent as PersonalizationEvent,
  type Profile,
  type SelectedPersonalizationArray,
  type TrackBuilderArgs,
  TrackEvent,
} from '@contentful/optimization-api-client'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import { isEqual } from 'es-toolkit'
import { logger } from 'logger'
import type { ConsentGuard } from '../Consent'
import { guardedBy } from '../lib/decorators'
import type { ProductConfig } from '../ProductBase'
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
import PersonalizationBase from './PersonalizationBase'
import { MergeTagValueResolver, PersonalizedEntryResolver, type ResolvedData } from './resolvers'

export interface PersonalizationProductConfigDefaults {
  consent?: boolean
  changes?: ChangeArray
  profile?: Profile
  personalizations?: SelectedPersonalizationArray
}

export interface PersonalizationProductConfig extends ProductConfig {
  defaults?: PersonalizationProductConfigDefaults
}

export interface PersonalizationStates {
  flags: Observable<Flags | undefined>
  profile: Observable<Profile | undefined>
  personalizations: Observable<SelectedPersonalizationArray | undefined>
}

class Personalization extends PersonalizationBase implements ConsentGuard {
  readonly states: PersonalizationStates = {
    flags: toObservable(flags),
    profile: toObservable(profile),
    personalizations: toObservable(personalizations),
  }

  constructor(api: ApiClient, builder: EventBuilder, config?: PersonalizationProductConfig) {
    super(api, builder, config)

    const { defaults } = config ?? {}

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

    if (defaults?.consent !== undefined) {
      const { consent: defaultConsent } = defaults
      consent.value = defaultConsent
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

  personalizeEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers = ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(
    entry: Entry<S, M, L>,
    personalizations: SelectedPersonalizationArray | undefined = personalizationsSignal.value,
  ): ResolvedData<S, M, L> {
    return PersonalizedEntryResolver.resolve<S, M, L>(entry, personalizations)
  }

  getMergeTagValue(
    embeddedEntryNodeTarget: MergeTagEntry,
    profile: Profile | undefined = profileSignal.value,
  ): unknown {
    return MergeTagValueResolver.resolve(embeddedEntryNodeTarget, profile)
  }

  hasConsent(name: string): boolean {
    if (name === 'trackComponentView') name = 'component'

    return !!consent.value || (this.allowedEventTypes ?? []).includes(name)
  }

  onBlockedByConsent(name: string, args: unknown[]): void {
    logger.warn(
      `[Personalization] Event "${name}" was blocked due to lack of consent; args: ${JSON.stringify(args)}`,
    )
  }

  isNotDuplicated(_name: string, args: [ComponentViewBuilderArgs, string]): boolean {
    const [{ componentId: value }, duplicationKey] = args

    const isDuplicated = this.duplicationDetector.isPresent(duplicationKey, value)

    if (!isDuplicated) this.duplicationDetector.addValue(duplicationKey, value)

    return !isDuplicated
  }

  onBlockedByDuplication(_name: string, args: unknown[]): void {
    logger.info(
      `[Analytics] Duplicate "component view" event detected, skipping; args: ${JSON.stringify(args)}`,
    )
  }

  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async identify(payload: IdentifyBuilderArgs): Promise<OptimizationData | undefined> {
    logger.info('[Personalization] Sending "identify" event')

    const event = IdentifyEvent.parse(this.builder.buildIdentify(payload))

    return await this.#upsertProfile(event)
  }

  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async page(payload: PageViewBuilderArgs): Promise<OptimizationData> {
    logger.info('[Personalization] Sending "page" event')

    const event = PageViewEvent.parse(this.builder.buildPageView(payload))

    return await this.#upsertProfile(event)
  }

  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async track(payload: TrackBuilderArgs): Promise<OptimizationData> {
    logger.info(`[Personalization] Sending "track" event "${payload.event}"`)

    const event = TrackEvent.parse(this.builder.buildTrack(payload))

    return await this.#upsertProfile(event)
  }

  /** AKA sticky component view */
  @guardedBy('isNotDuplicated', { onBlocked: 'onBlockedByDuplication' })
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async trackComponentView(payload: ComponentViewBuilderArgs): Promise<OptimizationData> {
    logger.info(`[Personalization] Sending "track personalization" event`)

    const event = ComponentViewEvent.parse(this.builder.buildComponentView(payload))

    return await this.#upsertProfile(event)
  }

  async #upsertProfile(event: PersonalizationEvent): Promise<OptimizationData> {
    const intercepted = await this.interceptor.event.run(event)

    eventSignal.value = intercepted

    const anonymousId = this.builder.getAnonymousId()
    if (anonymousId) logger.info('[Personalization] Anonymous ID found:', anonymousId)

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
