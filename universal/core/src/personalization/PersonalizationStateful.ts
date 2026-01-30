import {
  type InsightsEvent as AnalyticsEvent,
  type ChangeArray,
  type ComponentViewBuilderArgs,
  type Flags,
  type IdentifyBuilderArgs,
  type Json,
  type MergeTagEntry,
  type OptimizationData,
  type PageViewBuilderArgs,
  ExperienceEvent as PersonalizationEvent,
  type ExperienceEventArray as PersonalizationEventArray,
  type Profile,
  type ScreenViewBuilderArgs,
  type SelectedPersonalizationArray,
  type TrackBuilderArgs,
} from '@contentful/optimization-api-client'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import { isEqual } from 'es-toolkit'
import { createScopedLogger } from 'logger'
import type { ConsentGuard } from '../Consent'
import { guardedBy } from '../lib/decorators'
import type { ProductBaseOptions, ProductConfig } from '../ProductBase'
import {
  batch,
  changes as changesSignal,
  consent as consentSignal,
  effect,
  event as eventSignal,
  flags as flagsSignal,
  type Observable,
  online as onlineSignal,
  personalizations as personalizationsSignal,
  profile as profileSignal,
  toObservable,
} from '../signals'
import PersonalizationBase from './PersonalizationBase'
import type { ResolvedData } from './resolvers'

const logger = createScopedLogger('Personalization')

/**
 * Default state values for {@link PersonalizationStateful} applied at construction time.
 *
 * @public
 */
export interface PersonalizationProductConfigDefaults {
  /** Whether personalization is allowed by default. */
  consent?: boolean
  /** Initial diff of changes produced by the service. */
  changes?: ChangeArray
  /** Default active profile used for personalization. */
  profile?: Profile
  /** Preselected personalization variants (e.g., winning treatments). */
  personalizations?: SelectedPersonalizationArray
}

/**
 * Configuration for {@link PersonalizationStateful}.
 *
 * @public
 */
export interface PersonalizationProductConfig extends ProductConfig {
  /** Default signal values applied during initialization. */
  defaults?: PersonalizationProductConfigDefaults

  /**
   * Function used to obtain an anonymous user identifier.
   *
   * @remarks
   * If a `getAnonymousId` function has been provided, the returned value will
   * take precedence over the `id` property of the current {@link Profile}
   * signal value
   *
   * @returns A string identifier, or `undefined` if no anonymous ID is available.
   */
  getAnonymousId?: () => string | undefined
}

/**
 * Observables exposed by {@link PersonalizationStateful} that mirror internal signals.
 *
 * @public
 */
export interface PersonalizationStates {
  /** Observable stream of the latest {@link AnalyticsEvent} or {@link PersonalizationEvent} (or `undefined`). */
  eventStream: Observable<AnalyticsEvent | PersonalizationEvent | undefined>
  /** Live view of effective flags for the current profile (if available). */
  flags: Observable<Flags | undefined>
  /** Live view of the current profile. */
  profile: Observable<Profile | undefined>
  /** Live view of selected personalizations (variants). */
  personalizations: Observable<SelectedPersonalizationArray | undefined>
}

/**
 * Options for configuring {@link PersonalizationStateful} functionality.
 *
 * @public
 * @see {@link ProductBaseOptions}
 */
export type PersonalizationStatefulOptions = ProductBaseOptions & {
  /** Configuration specific to the Personalization product */
  config?: PersonalizationProductConfig
}

/**
 * Stateful personalization product that manages consent, profile, flags, and
 * selected variants while emitting Experience events and updating state.
 *
 * @public
 * @remarks
 * The class maintains reactive signals and exposes read‑only observables via
 * {@link PersonalizationStateful.states}. Events are validated via schema parsers and
 * run through interceptors before being submitted. Resulting state is merged
 * back into signals.
 */
class PersonalizationStateful extends PersonalizationBase implements ConsentGuard {
  /** In‑memory queue for offline events keyed by profile. */
  private readonly offlineQueue = new Set<PersonalizationEvent>()

  /** Exposed observable state references. */
  readonly states: PersonalizationStates = {
    eventStream: toObservable(eventSignal),
    flags: toObservable(flagsSignal),
    profile: toObservable(profileSignal),
    personalizations: toObservable(personalizationsSignal),
  }

  /**
   * Function that provides an anonymous ID when available.
   *
   * @internal
   */
  getAnonymousId: () => string | undefined

  /**
   * Create a new stateful personalization instance.
   *
   * @param options - Options to configure the personalization product for stateful environments.
   */
  constructor(options: PersonalizationStatefulOptions) {
    const { api, builder, config, interceptors } = options

    super({ api, builder, config, interceptors })

    const { defaults, getAnonymousId } = config ?? {}

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
      consentSignal.value = defaultConsent
    }

    this.getAnonymousId = getAnonymousId ?? (() => undefined)

    // Log signal changes for observability
    effect(() => {
      logger.debug(
        `Profile ${profileSignal.value && `with ID ${profileSignal.value.id}`} has been ${profileSignal.value ? 'set' : 'cleared'}`,
      )
    })

    effect(() => {
      logger.debug(
        `Variants have been ${personalizationsSignal.value?.length ? 'populated' : 'cleared'}`,
      )
    })

    effect(() => {
      logger.info(
        `Personalization ${consentSignal.value ? 'will' : 'will not'} take effect due to consent (${consentSignal.value})`,
      )
    })

    effect(() => {
      if (onlineSignal.value) void this.flush()
    })
  }

  /**
   * Reset stateful signals managed by this product.
   *
   * @remarks
   * Clears `changes`, `profile`, and selected `personalizations`.
   */
  reset(): void {
    batch(() => {
      changesSignal.value = undefined
      eventSignal.value = undefined
      profileSignal.value = undefined
      personalizationsSignal.value = undefined
    })
  }

  /**
   * Get the specified Custom Flag's value (derived from the signal).
   * @param name - The name or key of the Custom Flag.
   * @returns The current value of the Custom Flag if found.
   * */
  getCustomFlag(name: string, changes: ChangeArray | undefined = changesSignal.value): Json {
    return super.getCustomFlag(name, changes)
  }

  /**
   * Resolve a Contentful entry to a personalized variant using the current
   * or provided selections.
   *
   * @typeParam S - Entry skeleton type.
   * @typeParam M - Chain modifiers.
   * @typeParam L - Locale code.
   * @param entry - The entry to personalize.
   * @param personalizations - Optional selections; defaults to the current signal value.
   * @returns The resolved entry data.
   */
  personalizeEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers = ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(
    entry: Entry<S, M, L>,
    personalizations: SelectedPersonalizationArray | undefined = personalizationsSignal.value,
  ): ResolvedData<S, M, L> {
    return super.personalizeEntry<S, M, L>(entry, personalizations)
  }

  /**
   * Resolve a merge tag to a value based on the current (or provided) profile.
   *
   * @param embeddedEntryNodeTarget - The merge‑tag entry node to resolve.
   * @param profile - Optional profile; defaults to the current signal value.
   * @returns The resolved value (type depends on the tag).
   * @remarks
   * Merge tags are references to profile data that can be substituted into content.
   */
  getMergeTagValue(
    embeddedEntryNodeTarget: MergeTagEntry,
    profile: Profile | undefined = profileSignal.value,
  ): unknown {
    return super.getMergeTagValue(embeddedEntryNodeTarget, profile)
  }

  /**
   * Determine whether the named operation is permitted based on consent and
   * allowed event type configuration.
   *
   * @param name - Method name; `trackComponentView` is normalized to
   * `'component'` for allow‑list checks.
   * @returns `true` if the operation is permitted; otherwise `false`.
   */
  hasConsent(name: string): boolean {
    return (
      !!consentSignal.value ||
      (this.allowedEventTypes ?? []).includes(
        name === 'trackComponentView' || name === 'trackFlagView' ? 'component' : name,
      )
    )
  }

  /**
   * Hook invoked when an operation is blocked due to missing consent.
   *
   * @param name - The blocked operation name.
   * @param payload - The original arguments supplied to the operation.
   */
  onBlockedByConsent(name: string, payload: unknown[]): void {
    logger.warn(
      `Event "${name}" was blocked due to lack of consent; payload: ${JSON.stringify(payload)}`,
    )
  }

  /**
   * Guard used to suppress duplicate component view events for the same
   * component based on a duplication key and the component identifier.
   *
   * @param _name - Operation name (unused).
   * @param payload - Tuple `[builderArgs, duplicationScope]`.
   * @returns `true` if the event is NOT a duplicate and should proceed.
   */
  isNotDuplicated(_name: string, payload: [ComponentViewBuilderArgs, string]): boolean {
    const [{ componentId: value }, duplicationScope] = payload

    const isDuplicated = this.duplicationDetector.isPresent(duplicationScope, value)

    if (!isDuplicated) this.duplicationDetector.addValue(duplicationScope, value)

    return !isDuplicated
  }

  /**
   * Hook invoked when an operation is blocked by the duplication guard.
   *
   * @param _name - The blocked operation name (unused).
   * @param payload - The original arguments supplied to the operation.
   */
  onBlockedByDuplication(_name: string, payload: unknown[]): void {
    logger.debug(
      `Duplicate "component view" event detected, skipping; payload: ${JSON.stringify(payload)}`,
    )
  }

  /**
   * Identify the current profile/visitor to associate traits with a profile
   * and update optimization state.
   *
   * @param payload - Identify builder payload.
   * @returns The resulting {@link OptimizationData} for the identified user.
   */
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async identify(payload: IdentifyBuilderArgs): Promise<OptimizationData | undefined> {
    logger.info('Sending "identify" event')

    const event = this.builder.buildIdentify(payload)

    return await this.sendOrEnqueueEvent(event)
  }

  /**
   * Record a page view and update optimization state.
   *
   * @param payload - Page view builder payload.
   * @returns The evaluated {@link OptimizationData} for this page view.
   */
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async page(payload: PageViewBuilderArgs): Promise<OptimizationData | undefined> {
    logger.info('Sending "page" event')

    const event = this.builder.buildPageView(payload)

    return await this.sendOrEnqueueEvent(event)
  }

  /**
   * Record a screen view and update optimization state.
   *
   * @param payload - Screen view builder payload.
   * @returns The evaluated {@link OptimizationData} for this screen view.
   */
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async screen(payload: ScreenViewBuilderArgs): Promise<OptimizationData | undefined> {
    logger.info(`Sending "screen" event for "${payload.name}"`)

    const event = this.builder.buildScreenView(payload)

    return await this.sendOrEnqueueEvent(event)
  }

  /**
   * Record a custom track event and update optimization state.
   *
   * @param payload - Track builder payload.
   * @returns The evaluated {@link OptimizationData} for this event.
   */
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  async track(payload: TrackBuilderArgs): Promise<OptimizationData | undefined> {
    logger.info(`Sending "track" event "${payload.event}"`)

    const event = this.builder.buildTrack(payload)

    return await this.sendOrEnqueueEvent(event)
  }

  @guardedBy('isNotDuplicated', { onBlocked: 'onBlockedByDuplication' })
  @guardedBy('hasConsent', { onBlocked: 'onBlockedByConsent' })
  /**
   * Record a "sticky" component view and update optimization state.
   *
   * @param payload - Component view builder payload.
   * @param _duplicationScope - Optional duplication scope key used to suppress duplicates.
   * @returns The evaluated {@link OptimizationData} for this component view.
   */
  async trackComponentView(
    payload: ComponentViewBuilderArgs,
    _duplicationScope = '',
  ): Promise<OptimizationData | undefined> {
    logger.info(`Sending "track personalization" event for ${payload.componentId}`)

    const event = this.builder.buildComponentView(payload)

    return await this.sendOrEnqueueEvent(event)
  }

  /**
   * Intercept, validate, and place an event into the offline eventd queue; then
   * trigger a size‑based flush if necessary.
   *
   * @param event - The event to enqueue.
   */
  private async sendOrEnqueueEvent(
    event: PersonalizationEvent,
  ): Promise<OptimizationData | undefined> {
    const intercepted = await this.interceptors.event.run(event)

    const validEvent = PersonalizationEvent.parse(intercepted)

    eventSignal.value = validEvent

    if (onlineSignal.value) return await this.upsertProfile([validEvent])

    logger.debug(`Queueing ${validEvent.type} event`, validEvent)

    this.offlineQueue.add(validEvent)

    return undefined
  }

  /**
   * Flush the offline queue
   */
  async flush(): Promise<void> {
    if (this.offlineQueue.size === 0) return

    logger.debug('Flushing offline event queue')

    await this.upsertProfile(Array.from(this.offlineQueue))

    this.offlineQueue.clear()
  }

  /**
   * Submit events to the Experience API, updating output signals with the
   * returned state.
   *
   * @param events - The events to submit.
   * @returns The {@link OptimizationData} returned by the service.
   * @internal
   * @privateRemarks
   * If a `getAnonymousId` function has been provided, the returned value will
   * take precedence over the `id` property of the current {@link Profile}
   * signal value
   */
  private async upsertProfile(events: PersonalizationEventArray): Promise<OptimizationData> {
    const anonymousId = this.getAnonymousId()
    if (anonymousId) logger.debug(`Anonymous ID found: ${anonymousId}`)

    const data = await this.api.experience.upsertProfile({
      profileId: anonymousId ?? profileSignal.value?.id,
      events,
    })

    await this.updateOutputSignals(data)

    return data
  }

  /**
   * Apply returned optimization state to local signals after interceptor processing.
   *
   * @param data - Optimization state returned by the service.
   * @internal
   */
  private async updateOutputSignals(data: OptimizationData): Promise<void> {
    const intercepted = await this.interceptors.state.run(data)

    const { changes, personalizations, profile } = intercepted

    batch(() => {
      if (!isEqual(changesSignal.value, changes)) changesSignal.value = changes
      if (!isEqual(profileSignal.value, profile)) profileSignal.value = profile
      if (!isEqual(personalizationsSignal.value, personalizations))
        personalizationsSignal.value = personalizations
    })
  }
}

export default PersonalizationStateful
