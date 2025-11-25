import {
  type EntryReplacementComponent,
  type EntryReplacementVariant,
  isEntry,
  isEntryReplacementComponent,
  isEntryReplacementVariant,
  isPersonalizationEntry,
  isPersonalizedEntry,
  type PersonalizationEntry,
  type PersonalizedEntry,
  type SelectedPersonalization,
  type SelectedPersonalizationArray,
} from '@contentful/optimization-api-client'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import { logger } from 'logger'

/**
 * Result returned by {@link PersonalizedEntryResolver.resolve}.
 *
 * @typeParam S - Entry skeleton type.
 * @typeParam M - Chain modifiers.
 * @typeParam L - Locale code.
 * @public
 */
export interface ResolvedData<
  S extends EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> {
  /** The baseline or resolved variant entry. */
  entry: Entry<S, M, L>
  /** The selected personalization metadata, if a non‑baseline variant was chosen. */
  personalization?: SelectedPersonalization
}

/** Base string for resolver warning messages. */
const RESOLUTION_WARNING_BASE = '[Personalization] Could not resolve personalized entry variant:'

/**
 * Resolve a personalized Contentful entry to the correct variant for the current
 * selections.
 *
 * @public
 * @remarks
 * Given a baseline {@link PersonalizedEntry} and a set of selected personalizations
 * (variants per experience), this resolver finds the matching replacement variant
 * for the component configured against the baseline entry.
 *
 * **Variant indexing**: `variantIndex` in {@link SelectedPersonalization} is treated as
 * 1‑based (index 1 = first variant). A value of `0` indicates baseline.
 */
const PersonalizedEntryResolver = {
  /**
   * Find the personalization entry corresponding to one of the selected experiences.
   *
   * @param params - Object containing the baseline personalized entry and the selections.
   * @param skipValidation - When `true`, skip type/shape validation for perf.
   * @returns The matching {@link PersonalizationEntry}, or `undefined` if not found/invalid.
   * @example
   * ```ts
   * const personalizationEntry = PersonalizedEntryResolver.getPersonalizationEntry({
   *   personalizedEntry: entry,
   *   selectedPersonalizations
   * })
   * ```
   * @remarks
   * A personalization entry is a personalization configutation object supplied in a
   * `PersonalizedEntry.nt_experiences` array. A personalized entry may relate to
   * multiple personalizations.
   */
  getPersonalizationEntry(
    {
      personalizedEntry,
      selectedPersonalizations,
    }: {
      personalizedEntry: PersonalizedEntry
      selectedPersonalizations: SelectedPersonalizationArray
    },
    skipValidation = false,
  ): PersonalizationEntry | undefined {
    if (
      !skipValidation &&
      (!selectedPersonalizations.length || !isPersonalizedEntry(personalizedEntry))
    )
      return

    const personalizationEntry = personalizedEntry.fields.nt_experiences
      .filter((maybePersonalization) => isPersonalizationEntry(maybePersonalization))
      .find((personalization) =>
        selectedPersonalizations.some(
          (selectedPersonalization) =>
            selectedPersonalization.experienceId === personalization.sys.id,
        ),
      )

    return personalizationEntry
  },

  /**
   * Look up the selection metadata for a specific personalization entry.
   *
   * @param params - Object with the target personalization entry and selections.
   * @param skipValidation - When `true`, skip type checks.
   * @returns The matching {@link SelectedPersonalization}, if present.
   * @example
   * ```ts
   * const selectedPersonalization = PersonalizedEntryResolver.getSelectedPersonalization({
   *   personalizationEntry,
   *   selectedPersonalizations
   * })
   * ```
   * @remarks
   * Selected personalizations are supplied by the Experience API in the
   * `experiences` response data property.
   */
  getSelectedPersonalization(
    {
      personalizationEntry,
      selectedPersonalizations,
    }: {
      personalizationEntry: PersonalizationEntry
      selectedPersonalizations: SelectedPersonalizationArray
    },
    skipValidation = false,
  ): SelectedPersonalization | undefined {
    if (
      !skipValidation &&
      (!selectedPersonalizations.length || !isPersonalizationEntry(personalizationEntry))
    )
      return

    const selectedPersonalization = selectedPersonalizations.find(
      ({ experienceId }) => experienceId === personalizationEntry.sys.id,
    )

    return selectedPersonalization
  },

  /**
   * Get the replacement variant config for the given selection index.
   *
   * @param params - Baseline entry, personalization entry, and 1‑based variant index.
   * @param skipValidation - When `true`, skip type checks.
   * @returns The {@link EntryReplacementVariant} for the component, if any.
   * @example
   * ```ts
   * const selectedVariant = PersonalizedEntryResolver.getSelectedVariant({
   *   personalizedEntry: entry,
   *   personalizationEntry,
   *   selectedVariantIndex: 2 // second variant (1‑based)
   * })
   * ```
   * @remarks
   * Entry replacement variants are variant configurations specified in a
   * personalization configuration component's `variants` array supplied by the
   * personalized entry via its `nt_config` field.
   */
  getSelectedVariant(
    {
      personalizedEntry,
      personalizationEntry,
      selectedVariantIndex,
    }: {
      personalizedEntry: PersonalizedEntry
      personalizationEntry: PersonalizationEntry
      selectedVariantIndex: number
    },
    skipValidation = false,
  ): EntryReplacementVariant | undefined {
    if (
      !skipValidation &&
      (!isPersonalizedEntry(personalizedEntry) || !isPersonalizationEntry(personalizationEntry))
    )
      return

    const relevantVariants = personalizationEntry.fields.nt_config?.components
      ?.filter(
        (component): component is EntryReplacementComponent =>
          isEntryReplacementComponent(component) && !component.baseline.hidden,
      )
      .find((component) => component.baseline.id === personalizedEntry.sys.id)?.variants

    if (!relevantVariants?.length) return

    return relevantVariants.at(selectedVariantIndex - 1)
  },

  /**
   * Resolve the concrete Contentful entry that corresponds to a selected variant.
   *
   * @typeParam S - Entry skeleton type.
   * @typeParam M - Chain modifiers.
   * @typeParam L - Locale code.
   * @param params - Personalization entry and selected variant.
   * @param skipValidation - When `true`, skip type checks.
   * @returns The resolved entry typed as {@link Entry} or `undefined`.
   * @example
   * ```ts
   * const selectedVariantEntry = PersonalizedEntryResolver.getSelectedVariantEntry<{ fields: unknown }>({
   *   personalizationEntry,
   *   selectedVariant
   * })
   * ```
   * @remarks
   * A personalized entry will resolve either to the baseline (the entry
   * supplied as `personalizedEntry`) or the selected variant.
   */
  getSelectedVariantEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers = ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(
    {
      personalizationEntry,
      selectedVariant,
    }: {
      personalizationEntry: PersonalizationEntry
      selectedVariant: EntryReplacementVariant
    },
    skipValidation = false,
  ): Entry<S, M, L> | undefined {
    if (
      !skipValidation &&
      (!isPersonalizationEntry(personalizationEntry) || !isEntryReplacementVariant(selectedVariant))
    )
      return

    const selectedVariantEntry = personalizationEntry.fields.nt_variants?.find(
      (variant) => variant.sys.id === selectedVariant.id,
    )

    return isEntry<S, M, L>(selectedVariantEntry) ? selectedVariantEntry : undefined
  },

  /**
   * Resolve the selected entry (baseline or variant) for a personalized entry
   * and optional selected personalizations, returning both the entry and the
   * personalization metadata.
   *
   * @typeParam S - Entry skeleton type.
   * @typeParam M - Chain modifiers.
   * @typeParam L - Locale code.
   * @param entry - The baseline personalized entry.
   * @param selectedPersonalizations - Optional selections for the current profile.
   * @returns An object containing the resolved entry and (if chosen) the selection.
   * @example
   * ```ts
   * const { entry: personalizedEntry, personalization } = PersonalizedEntryResolver.resolve(entry, selections)
   * if (personalization) console.log('Variant index', personalization.variantIndex)
   * ```
   */
  resolve<
    S extends EntrySkeletonType,
    M extends ChainModifiers = ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(
    entry: Entry<S, M, L>,
    selectedPersonalizations?: SelectedPersonalizationArray,
  ): ResolvedData<S, M, L> {
    logger.info('[Personalization] Resolving personalized entry for baseline entry', entry.sys.id)

    if (!selectedPersonalizations?.length) {
      logger.warn(
        RESOLUTION_WARNING_BASE,
        'no selectedPersonalizations exist for the current profile',
      )
      return { entry }
    }

    if (!isPersonalizedEntry(entry)) {
      logger.warn(RESOLUTION_WARNING_BASE, `entry ${entry.sys.id} is not personalized`)
      return { entry }
    }

    const personalizationEntry = PersonalizedEntryResolver.getPersonalizationEntry(
      {
        personalizedEntry: entry,
        selectedPersonalizations,
      },
      true,
    )

    if (!personalizationEntry) {
      logger.warn(
        RESOLUTION_WARNING_BASE,
        `could not find a personalization entry for ${entry.sys.id}`,
      )
      return { entry }
    }

    const selectedPersonalization = PersonalizedEntryResolver.getSelectedPersonalization(
      {
        personalizationEntry,
        selectedPersonalizations,
      },
      true,
    )

    const selectedVariantIndex = selectedPersonalization?.variantIndex ?? 0

    if (selectedVariantIndex === 0) {
      logger.info(
        `[Personalization] Resolved personalization entry for entry ${entry.sys.id} is baseline`,
      )

      return { entry }
    }

    const selectedVariant = PersonalizedEntryResolver.getSelectedVariant(
      {
        personalizedEntry: entry,
        personalizationEntry,
        selectedVariantIndex,
      },
      true,
    )

    if (!selectedVariant) {
      logger.warn(
        RESOLUTION_WARNING_BASE,
        `could not find a valid replacement variant entry for ${entry.sys.id}`,
      )
      return { entry }
    }

    const selectedVariantEntry = PersonalizedEntryResolver.getSelectedVariantEntry<S, M, L>(
      {
        personalizationEntry,
        selectedVariant,
      },
      true,
    )

    if (!selectedVariantEntry) {
      logger.warn(
        RESOLUTION_WARNING_BASE,
        `could not find a valid replacement variant entry for ${entry.sys.id}`,
      )
      return { entry }
    } else {
      logger.info(
        `[Personalization] Entry ${entry.sys.id} has been resolved to variant entry ${selectedVariantEntry.sys.id}`,
      )
    }

    return { entry: selectedVariantEntry, personalization: selectedPersonalization }
  },
}

export default PersonalizedEntryResolver
