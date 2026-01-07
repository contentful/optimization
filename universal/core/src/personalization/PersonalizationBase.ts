import type {
  ChangeArray,
  ComponentViewBuilderArgs,
  IdentifyBuilderArgs,
  Json,
  MergeTagEntry,
  OptimizationData,
  PageViewBuilderArgs,
  ExperienceEvent as PersonalizationEvent,
  Profile,
  SelectedPersonalizationArray,
  TrackBuilderArgs,
} from '@contentful/optimization-api-client'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import ProductBase from '../ProductBase'
import {
  FlagsResolver,
  MergeTagValueResolver,
  PersonalizedEntryResolver,
  type ResolvedData,
} from './resolvers'

/**
 * These methods assist in resolving values via Resolvers
 *
 * @internal
 * @privateRemarks
 * This interface exists to document that the included methods should not be
 * considered static.
 */
interface ResolverMethods {
  /**
   * Get the specified Custom Flag's value from the supplied changes.
   * @param name - The name or key of the Custom Flag.
   * @param changes - Optional changes array.
   * @returns The current value of the Custom Flag if found.
   * @remarks
   * The changes array can be sourced from the data returned when emitting any
   * personalization event.
   * */
  getCustomFlag: (name: string, changes?: ChangeArray) => Json

  /**
   * Resolve a Contentful entry to a personalized variant using the current
   * or provided selected personalizations.
   *
   * @typeParam S - Entry skeleton type.
   * @typeParam M - Chain modifiers.
   * @typeParam L - Locale code.
   * @param entry - The entry to personalize.
   * @param personalizations - Optional selections.
   * @returns The resolved entry data.
   * @remarks
   * Selected personalizations can be sourced from the data returned when emitting any
   * personalization event.
   */
  personalizeEntry: <S extends EntrySkeletonType, M extends ChainModifiers, L extends LocaleCode>(
    entry: Entry<S, M, L>,
    personalizations?: SelectedPersonalizationArray,
  ) => ResolvedData<S, M, L>

  /**
   * Resolve a merge tag to a value based on the current (or provided) profile.
   *
   * @param embeddedEntryNodeTarget - The merge‑tag entry node to resolve.
   * @param profile - Optional profile.
   * @returns The resolved value (type depends on the tag).
   * @remarks
   * Merge tags are references to profile data that can be substituted into content. The
   * profile can be sourced from the data returned when emitting any personalization event.
   */
  getMergeTagValue: (embeddedEntryNodeTarget: MergeTagEntry, profile?: Profile) => unknown
}

/**
 * Internal base for personalization products.
 *
 * @internal
 * @remarks
 * Concrete implementations should extend this class to expose public methods for
 * identify, page, and track events. This base wires in shared singleton
 * resolvers used to fetch/resolve personalized data.
 */
abstract class PersonalizationBase
  extends ProductBase<PersonalizationEvent>
  implements ResolverMethods
{
  /**
   * Static {@link FlagsResolver | resolver} for evaluating personalized
   * custom flags.
   */
  readonly flagsResolver = FlagsResolver

  /**
   * Static {@link MergeTagValueResolver | resolver} that returns values
   * sourced from a user profile based on a Contentful Merge Tag entry.
   */
  readonly mergeTagValueResolver = MergeTagValueResolver

  /**
   * Static {@link PersonalizedEntryResolver | resolver } for personalized
   * Contentful entries (e.g., entry variants targeted to a profile audience).
   *
   * @remarks
   * Used by higher-level personalization flows to materialize entry content
   * prior to event emission.
   */
  readonly personalizedEntryResolver = PersonalizedEntryResolver

  /**
   * Get the specified Custom Flag's value from the supplied changes.
   * @param name - The name/key of the Custom Flag.
   * @param changes - Optional changes array.
   * @returns The current value of the Custom Flag if found.
   * @remarks
   * The changes array can be sourced from the data returned when emitting any
   * personalization event.
   * */
  getCustomFlag(name: string, changes?: ChangeArray): Json {
    return FlagsResolver.resolve(changes)[name]
  }

  /**
   * Resolve a Contentful entry to a personalized variant using the current
   * or provided selected personalizations.
   *
   * @typeParam S - Entry skeleton type.
   * @typeParam M - Chain modifiers.
   * @typeParam L - Locale code.
   * @param entry - The entry to personalize.
   * @param personalizations - Optional selected personalizations.
   * @returns The resolved entry data.
   * @remarks
   * Selected personalizations can be sourced from the data returned when emitting any
   * personalization event.
   */
  personalizeEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers = ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(entry: Entry<S, M, L>, personalizations?: SelectedPersonalizationArray): ResolvedData<S, M, L> {
    return PersonalizedEntryResolver.resolve<S, M, L>(entry, personalizations)
  }

  /**
   * Resolve a merge tag to a value based on the current (or provided) profile.
   *
   * @param embeddedEntryNodeTarget - The merge tag entry node to resolve.
   * @param profile - Optional profile.
   * @returns The resolved value (type depends on the tag).
   * @remarks
   * Merge tags are references to profile data that can be substituted into content. The
   * profile can be sourced from the data returned when emitting any personalization event.
   */
  getMergeTagValue(embeddedEntryNodeTarget: MergeTagEntry, profile?: Profile): unknown {
    return MergeTagValueResolver.resolve(embeddedEntryNodeTarget, profile)
  }

  /**
   * Identify the current profile/visitor to associate traits with a profile.
   *
   * @param payload - Identify builder payload.
   * @returns The resulting {@link OptimizationData} for the identified user if the device is online.
   */
  abstract identify(payload: IdentifyBuilderArgs): Promise<OptimizationData | undefined>

  /**
   * Record a page view.
   *
   * @param payload - Page view builder payload.
   * @returns The evaluated {@link OptimizationData} for this page view if the device is online.
   */
  abstract page(payload: PageViewBuilderArgs): Promise<OptimizationData | undefined>

  /**
   * Record a custom track event.
   *
   * @param payload - Track builder payload.
   * @returns The evaluated {@link OptimizationData} for this event if the device is online.
   */
  abstract track(payload: TrackBuilderArgs): Promise<OptimizationData | undefined>

  /**
   * Record a "sticky" component view.
   *
   * @param payload - "Sticky" component view builder payload.
   * @returns The evaluated {@link OptimizationData} for this component view if the device is online.
   * @remarks
   * This method is intended to be called only when a component is considered
   * "sticky".
   * @privateRemarks
   * Duplication prevention should be handled in Stateful implementations.
   */
  abstract trackComponentView(
    payload: ComponentViewBuilderArgs,
    duplicationScope?: string,
  ): Promise<OptimizationData | undefined>
}

export default PersonalizationBase
