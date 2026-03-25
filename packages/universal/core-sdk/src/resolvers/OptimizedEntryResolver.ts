import {
  type EntryReplacementComponent,
  type EntryReplacementVariant,
  isEntry,
  isEntryReplacementComponent,
  isEntryReplacementVariant,
  isOptimizationEntry,
  isOptimizedEntry,
  normalizeOptimizationConfig,
  type OptimizationEntry,
  type OptimizedEntry,
  type SelectedPersonalization,
  type SelectedPersonalizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'

const logger = createScopedLogger('Optimization')

/**
 * Result returned by {@link OptimizedEntryResolver.resolve}.
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

/**
 * Base string for resolver warning messages.
 *
 * @internal
 */
const RESOLUTION_WARNING_BASE = 'Could not resolve optimized entry variant:'

/**
 * Resolve the selected entry (baseline or variant) for an optimized entry
 * and optional selected personalizations, returning both the entry and the
 * personalization metadata.
 *
 * @typeParam S - Entry skeleton type.
 * @typeParam L - Locale code.
 * @typeParam M - Chain modifiers for advanced/non-default Contentful clients.
 * @param entry - The baseline optimized entry.
 * @param selectedPersonalizations - Optional selections for the current profile.
 * @returns An object containing the resolved entry and (if chosen) the selection.
 * @example
 * ```ts
 * const { entry: optimizedEntry, personalization } = OptimizedEntryResolver.resolve(
 *   entry,
 *   selections,
 * )
 * if (personalization) console.log('Variant index', personalization.variantIndex)
 * ```
 */
function resolve<
  S extends EntrySkeletonType = EntrySkeletonType,
  L extends LocaleCode = LocaleCode,
>(
  entry: Entry<S, undefined, L>,
  selectedPersonalizations?: SelectedPersonalizationArray,
): ResolvedData<S, undefined, L>
function resolve<
  S extends EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(
  entry: Entry<S, M, L>,
  selectedPersonalizations?: SelectedPersonalizationArray,
): ResolvedData<S, M, L>
function resolve<
  S extends EntrySkeletonType,
  M extends ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(
  entry: Entry<S, M, L>,
  selectedPersonalizations?: SelectedPersonalizationArray,
): ResolvedData<S, M, L> {
  logger.debug(`Resolving optimized entry for baseline entry ${entry.sys.id}`)

  if (!selectedPersonalizations?.length) {
    logger.warn(
      `${RESOLUTION_WARNING_BASE} no selectedPersonalizations exist for the current profile`,
    )
    return { entry }
  }

  if (!isOptimizedEntry(entry)) {
    logger.warn(`${RESOLUTION_WARNING_BASE} entry ${entry.sys.id} is not optimized`)
    return { entry }
  }

  const optimizationEntry = OptimizedEntryResolver.getOptimizationEntry(
    {
      optimizedEntry: entry,
      selectedPersonalizations,
    },
    true,
  )

  if (!optimizationEntry) {
    logger.warn(
      `${RESOLUTION_WARNING_BASE} could not find an optimization entry for ${entry.sys.id}`,
    )
    return { entry }
  }

  const selectedPersonalization = OptimizedEntryResolver.getSelectedPersonalization(
    {
      optimizationEntry,
      selectedPersonalizations,
    },
    true,
  )

  const selectedVariantIndex = selectedPersonalization?.variantIndex ?? 0

  if (selectedVariantIndex === 0) {
    logger.debug(`Resolved optimization entry for entry ${entry.sys.id} is baseline`)

    return { entry }
  }

  const selectedVariant = OptimizedEntryResolver.getSelectedVariant(
    {
      optimizedEntry: entry,
      optimizationEntry,
      selectedVariantIndex,
    },
    true,
  )

  if (!selectedVariant) {
    logger.warn(
      `${RESOLUTION_WARNING_BASE} could not find a valid replacement variant entry for ${entry.sys.id}`,
    )
    return { entry }
  }

  const selectedVariantEntry = OptimizedEntryResolver.getSelectedVariantEntry<S, M, L>(
    {
      optimizationEntry,
      selectedVariant,
    },
    true,
  )

  if (!selectedVariantEntry) {
    logger.warn(
      `${RESOLUTION_WARNING_BASE} could not find a valid replacement variant entry for ${entry.sys.id}`,
    )
    return { entry }
  } else {
    logger.debug(
      `Entry ${entry.sys.id} has been resolved to variant entry ${selectedVariantEntry.sys.id}`,
    )
  }

  return { entry: selectedVariantEntry, personalization: selectedPersonalization }
}

/**
 * Resolve an optimized Contentful entry to the correct variant for the current
 * selections.
 *
 * @public
 * @remarks
 * Given a baseline {@link OptimizedEntry} and a set of selected personalizations
 * (variants per experience), this resolver finds the matching replacement variant
 * for the component configured against the baseline entry.
 *
 * **Variant indexing**: `variantIndex` in {@link SelectedPersonalization} is treated as
 * 1‑based (index 1 = first variant). A value of `0` indicates baseline.
 */
const OptimizedEntryResolver = {
  /**
   * Find the optimization entry corresponding to one of the selected experiences.
   *
   * @param params - Object containing the baseline optimized entry and the selections.
   * @param skipValidation - When `true`, skip type/shape validation for perf.
   * @returns The matching {@link OptimizationEntry}, or `undefined` if not found/invalid.
   * @remarks
   * An optimization entry is an optimization configuration object supplied in an
   * `OptimizedEntry.nt_experiences` array. An optimized entry may relate to
   * multiple personalizations.
   * @example
   * ```ts
   * const optimizationEntry = OptimizedEntryResolver.getOptimizationEntry({
   *   optimizedEntry: entry,
   *   selectedPersonalizations
   * })
   * ```
   */
  getOptimizationEntry(
    {
      optimizedEntry,
      selectedPersonalizations,
    }: {
      optimizedEntry: OptimizedEntry
      selectedPersonalizations: SelectedPersonalizationArray
    },
    skipValidation = false,
  ): OptimizationEntry | undefined {
    if (!skipValidation && (!selectedPersonalizations.length || !isOptimizedEntry(optimizedEntry)))
      return

    const optimizationEntry = optimizedEntry.fields.nt_experiences
      .filter((maybeOptimization) => isOptimizationEntry(maybeOptimization))
      .find((optimizationEntry) =>
        selectedPersonalizations.some(
          ({ experienceId }) => experienceId === optimizationEntry.fields.nt_experience_id,
        ),
      )

    return optimizationEntry
  },

  /**
   * Look up the selection metadata for a specific optimization entry.
   *
   * @param params - Object with the target optimization entry and selections.
   * @param skipValidation - When `true`, skip type checks.
   * @returns The matching {@link SelectedPersonalization}, if present.
   * @remarks
   * Selected personalizations are supplied by the Experience API in the
   * `experiences` response data property.
   * @example
   * ```ts
   * const selectedPersonalization = OptimizedEntryResolver.getSelectedPersonalization({
   *   optimizationEntry,
   *   selectedPersonalizations
   * })
   * ```
   */
  getSelectedPersonalization(
    {
      optimizationEntry,
      selectedPersonalizations,
    }: {
      optimizationEntry: OptimizationEntry
      selectedPersonalizations: SelectedPersonalizationArray
    },
    skipValidation = false,
  ): SelectedPersonalization | undefined {
    if (
      !skipValidation &&
      (!selectedPersonalizations.length || !isOptimizationEntry(optimizationEntry))
    )
      return

    const selectedPersonalization = selectedPersonalizations.find(
      ({ experienceId }) => experienceId === optimizationEntry.fields.nt_experience_id,
    )

    return selectedPersonalization
  },

  /**
   * Get the replacement variant config for the given selection index.
   *
   * @param params - Baseline entry, optimization entry, and 1‑based variant index.
   * @param skipValidation - When `true`, skip type checks.
   * @returns The {@link EntryReplacementVariant} for the component, if any.
   * @remarks
   * Entry replacement variants are variant configurations specified in a
   * optimization configuration component's `variants` array supplied by the
   * optimized entry via its `nt_config` field.
   * @example
   * ```ts
   * const selectedVariant = OptimizedEntryResolver.getSelectedVariant({
   *   optimizedEntry: entry,
   *   optimizationEntry,
   *   selectedVariantIndex: 2 // second variant (1‑based)
   * })
   * ```
   */
  getSelectedVariant(
    {
      optimizedEntry,
      optimizationEntry,
      selectedVariantIndex,
    }: {
      optimizedEntry: OptimizedEntry
      optimizationEntry: OptimizationEntry
      selectedVariantIndex: number
    },
    skipValidation = false,
  ): EntryReplacementVariant | undefined {
    if (
      !skipValidation &&
      (!isOptimizedEntry(optimizedEntry) || !isOptimizationEntry(optimizationEntry))
    )
      return

    const relevantVariants = normalizeOptimizationConfig(optimizationEntry.fields.nt_config)
      .components.filter(
        (component): component is EntryReplacementComponent =>
          isEntryReplacementComponent(component) && !component.baseline.hidden,
      )
      .find((component) => component.baseline.id === optimizedEntry.sys.id)?.variants

    if (!relevantVariants?.length) return

    return relevantVariants.at(selectedVariantIndex - 1)
  },

  /**
   * Resolve the concrete Contentful entry that corresponds to a selected variant.
   *
   * @typeParam S - Entry skeleton type.
   * @typeParam M - Chain modifiers.
   * @typeParam L - Locale code.
   * @param params - Optimization entry and selected variant.
   * @param skipValidation - When `true`, skip type checks.
   * @returns The resolved entry typed as {@link Entry} or `undefined`.
   * @remarks
   * An optimized entry will resolve either to the baseline (the entry
   * supplied as `optimizedEntry`) or the selected variant.
   * @example
   * ```ts
   * const selectedVariantEntry = OptimizedEntryResolver.getSelectedVariantEntry<{ fields: unknown }>({
   *   optimizationEntry,
   *   selectedVariant
   * })
   * ```
   */
  getSelectedVariantEntry<
    S extends EntrySkeletonType,
    M extends ChainModifiers = ChainModifiers,
    L extends LocaleCode = LocaleCode,
  >(
    {
      optimizationEntry,
      selectedVariant,
    }: {
      optimizationEntry: OptimizationEntry
      selectedVariant: EntryReplacementVariant
    },
    skipValidation = false,
  ): Entry<S, M, L> | undefined {
    if (
      !skipValidation &&
      (!isOptimizationEntry(optimizationEntry) || !isEntryReplacementVariant(selectedVariant))
    )
      return

    const selectedVariantEntry = optimizationEntry.fields.nt_variants?.find(
      (variant) => variant.sys.id === selectedVariant.id,
    )

    return isEntry<S, M, L>(selectedVariantEntry) ? selectedVariantEntry : undefined
  },

  resolve,
}

export default OptimizedEntryResolver
