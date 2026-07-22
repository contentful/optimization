import {
  type EntryReplacementComponent,
  type EntryReplacementVariant,
  isEntryReplacementComponent,
  isEntryReplacementVariant,
  isResolvedAudienceEntry,
  isResolvedContentfulEntry,
  isResolvedOptimizationEntry,
  isResolvedOptimizedEntry,
  normalizeOptimizationConfig,
  type OptimizationEntry,
  type OptimizedEntry,
  type SelectedOptimization,
  type SelectedOptimizationArray,
} from '@contentful/optimization-api-client/api-schemas'
import { createScopedLogger } from '@contentful/optimization-api-client/logger'
import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import type { EventOptimizationContext } from '../events'

const logger = createScopedLogger('Optimization')

export type PendingEventOptimizationContext = Omit<EventOptimizationContext, 'contextId'>

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
  /** The selected optimization metadata, if a matching optimization was selected. */
  selectedOptimization?: SelectedOptimization
  /** Opaque runtime-owned optimization context ID for entry interaction tracking. */
  optimizationContextId?: string
  /**
   * Whether the resolved variant is an empty variant — a deliberate author choice to
   * render nothing for this audience. When `true`, the entry field still contains the
   * baseline entry (used for tracking context) but renderers must display no content.
   * This is distinct from a baseline selection (`variantIndex === 0`) and from a
   * resolution error (broken variant link), both of which render the baseline entry.
   *
   * An empty variant is detected by `selectedVariant.id === ''`. Empty variants appear
   * in two forms in Contentful CDA `nt_config` data:
   *
   * - `{ id: "", hidden: true }` — the author explicitly chose "Use empty variant" in
   *   the Personalization UI. This is the deliberate author intent for this feature.
   * - `{ id: "", hidden: false }` — an unfilled placeholder slot, created
   *   programmatically when a variant is added or unlinked but not yet configured.
   *
   * Both forms produce `isEmptyVariant: true`. The `hidden` field is not used for
   * detection because the Experience API strips it before runtime — it only survives
   * in the Contentful CDA `nt_config` payload. Using `id === ''` catches both forms
   * and is stable across all data sources.
   */
  isEmptyVariant?: true
}

/**
 * Result returned by {@link OptimizedEntryResolver.resolveWithContext}.
 *
 * @typeParam S - Entry skeleton type.
 * @typeParam M - Chain modifiers.
 * @typeParam L - Locale code.
 * @internal
 */
export interface ResolvedDataWithOptimizationContext<
  S extends EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> {
  readonly resolvedData: ResolvedData<S, M, L>
  readonly optimizationContext?: PendingEventOptimizationContext
}

/**
 * Base string for resolver warning messages.
 *
 * @internal
 */
const RESOLUTION_WARNING_BASE = 'Could not resolve optimized entry variant:'

/** @internal */
function isResolvedEntryForBaseline<
  S extends EntrySkeletonType,
  M extends ChainModifiers,
  L extends LocaleCode,
>(value: unknown, baselineEntry: Entry<S, M, L>): value is Entry<S, M, L> {
  return (
    isResolvedContentfulEntry(value) &&
    value.sys.contentType.sys.id === baselineEntry.sys.contentType.sys.id
  )
}

/**
 * Resolve a variant for a cf-entities-backed selection — no CT-twin
 * optimization entry walks us to the variant; the lookup uses XP's
 * `selectedOptimization.variants` baseline→variant entry-ID map instead.
 *
 * @internal
 */
function resolveCfEntitiesVariant<
  S extends EntrySkeletonType,
  M extends ChainModifiers,
  L extends LocaleCode,
>(
  entry: Entry<S, M, L> & OptimizedEntry,
  selectedOptimization: SelectedOptimization,
  resolveTo: (
    resolvedEntry: Entry<S, M, L>,
    selectedVariant?: EntryReplacementVariant,
    isEmptyVariant?: true,
  ) => ResolvedDataWithOptimizationContext<S, M, L>,
): ResolvedDataWithOptimizationContext<S, M, L> {
  const mappedVariantId: string | undefined = selectedOptimization.variants[entry.sys.id]

  if (mappedVariantId === '') {
    logger.debug(
      `Entry ${entry.sys.id} resolved to empty variant via variants map — rendering nothing`,
    )
    return resolveTo(entry, undefined, true)
  }

  if (typeof mappedVariantId !== 'string') {
    return { resolvedData: { entry } }
  }

  // Fast path — hydrate variant from any co-present `nt_experiences` graph
  // (retains CT-identity check). Not reachable → fall back to baseline for
  // the hackathon; a follow-up will thread an async
  // `sdk.fetchContentfulEntry(mappedVariantId, { include: 10 })` here.
  const linkedVariant: unknown = entry.fields.nt_experiences
    .filter((maybeOptimization) => isResolvedOptimizationEntry(maybeOptimization))
    .flatMap((optimization) => optimization.fields.nt_variants ?? [])
    .find((candidate) => candidate.sys.id === mappedVariantId)

  if (isResolvedEntryForBaseline<S, M, L>(linkedVariant, entry)) {
    logger.debug(
      `Entry ${entry.sys.id} resolved to variant entry ${mappedVariantId} via variants map`,
    )
    return resolveTo(linkedVariant)
  }

  logger.warn(
    `${RESOLUTION_WARNING_BASE} variants map named variant ${mappedVariantId} for baseline ${entry.sys.id}, but it was not reachable in the resolved graph`,
  )
  return resolveTo(entry)
}

/**
 * Resolve the selected entry (baseline or variant) for an optimized entry
 * and optional selected optimizations, returning both the entry and the
 * optimization metadata.
 *
 * @typeParam S - Entry skeleton type.
 * @typeParam L - Locale code.
 * @typeParam M - Chain modifiers for advanced/non-default Contentful clients.
 * @param entry - The baseline optimized entry.
 * @param selectedOptimizations - Optional selections for the current profile.
 * @returns An object containing the resolved entry and (if chosen) the selection.
 * @example
 * ```ts
 * const { entry: optimizedEntry, selectedOptimization } = OptimizedEntryResolver.resolve(
 *   entry,
 *   selections,
 * )
 * if (selectedOptimization) {
 *   console.log('Variant index', selectedOptimization.variantIndex)
 * }
 * ```
 */
function resolve<
  S extends EntrySkeletonType = EntrySkeletonType,
  L extends LocaleCode = LocaleCode,
>(
  entry: Entry<S, undefined, L>,
  selectedOptimizations?: SelectedOptimizationArray,
): ResolvedData<S, undefined, L>
function resolve<
  S extends EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(entry: Entry<S, M, L>, selectedOptimizations?: SelectedOptimizationArray): ResolvedData<S, M, L>
function resolve<
  S extends EntrySkeletonType,
  M extends ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(entry: Entry<S, M, L>, selectedOptimizations?: SelectedOptimizationArray): ResolvedData<S, M, L> {
  return resolveWithContext(entry, selectedOptimizations).resolvedData
}

function resolveWithContext<
  S extends EntrySkeletonType = EntrySkeletonType,
  L extends LocaleCode = LocaleCode,
>(
  entry: Entry<S, undefined, L>,
  selectedOptimizations?: SelectedOptimizationArray,
): ResolvedDataWithOptimizationContext<S, undefined, L>
function resolveWithContext<
  S extends EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(
  entry: Entry<S, M, L>,
  selectedOptimizations?: SelectedOptimizationArray,
): ResolvedDataWithOptimizationContext<S, M, L>
function resolveWithContext<
  S extends EntrySkeletonType,
  M extends ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(
  entry: Entry<S, M, L>,
  selectedOptimizations?: SelectedOptimizationArray,
): ResolvedDataWithOptimizationContext<S, M, L> {
  logger.debug(`Resolving optimized entry for baseline entry ${entry.sys.id}`)

  if (!selectedOptimizations?.length) {
    logger.warn(`${RESOLUTION_WARNING_BASE} no selectedOptimizations exist for the current profile`)
    return { resolvedData: { entry } }
  }

  if (!isResolvedOptimizedEntry(entry)) {
    logger.warn(`${RESOLUTION_WARNING_BASE} entry ${entry.sys.id} is not optimized`)
    return { resolvedData: { entry } }
  }

  const optimizationEntry = OptimizedEntryResolver.getOptimizationEntry({
    optimizedEntry: entry,
    selectedOptimizations,
  })

  const selectedOptimization = optimizationEntry
    ? OptimizedEntryResolver.getSelectedOptimization({
        optimizationEntry,
        selectedOptimizations,
      })
    : selectedOptimizations.find((candidate) => candidate.variants[entry.sys.id] !== undefined)

  if (!selectedOptimization) {
    if (!optimizationEntry) {
      logger.warn(
        `${RESOLUTION_WARNING_BASE} could not find an optimization entry for ${entry.sys.id}`,
      )
    }
    return { resolvedData: { entry } }
  }

  const maybeAudienceEntry = optimizationEntry?.fields.nt_audience

  const resolveTo = (
    resolvedEntry: Entry<S, M, L>,
    selectedVariant?: EntryReplacementVariant,
    isEmptyVariant?: true,
  ): ResolvedDataWithOptimizationContext<S, M, L> => {
    const audienceEntry = isResolvedAudienceEntry(maybeAudienceEntry)
      ? maybeAudienceEntry
      : undefined

    return {
      resolvedData: {
        entry: resolvedEntry,
        selectedOptimization,
        ...(isEmptyVariant ? { isEmptyVariant } : {}),
      },
      // cf-entities-backed selections have no CT-twin `optimizationEntry`; the
      // tracking-context payload loses `experience` / `audience` refs. Documented
      // degradation — XP-side contract addition tracked elsewhere.
      optimizationContext: optimizationEntry
        ? ({
            selectedOptimization,
            optimizationEntry,
            ...(audienceEntry ? { audienceEntry } : {}),
            baselineEntry: entry,
            resolvedEntry,
            ...(selectedVariant ? { selectedVariant } : {}),
          } satisfies PendingEventOptimizationContext)
        : undefined,
    }
  }

  // cf-entities-backed short-circuit — no CT-twin optimization entry walks us
  // to the variant, but XP emits `selectedOptimization.variants` as a
  // baseline→variant entry-ID map (see `SelectedOptimization.variants`).
  //
  // Only fires when the CT-twin graph is absent; the CT-backed path owns the
  // tracking-context payload's `experience` / `audience` / `selectedVariant`
  // refs. Rationale is documented in
  // specs/adhoc-cf-entities-migration/coin-demo-spec.md § Change B.
  return optimizationEntry
    ? resolveCtBackedVariant<S, M, L>(entry, optimizationEntry, selectedOptimization, resolveTo)
    : resolveCfEntitiesVariant<S, M, L>(entry, selectedOptimization, resolveTo)
}

/** @internal */
function resolveCtBackedVariant<
  S extends EntrySkeletonType,
  M extends ChainModifiers,
  L extends LocaleCode,
>(
  entry: Entry<S, M, L> & OptimizedEntry,
  optimizationEntry: OptimizationEntry,
  selectedOptimization: SelectedOptimization,
  resolveTo: (
    resolvedEntry: Entry<S, M, L>,
    selectedVariant?: EntryReplacementVariant,
    isEmptyVariant?: true,
  ) => ResolvedDataWithOptimizationContext<S, M, L>,
): ResolvedDataWithOptimizationContext<S, M, L> {
  const { variantIndex: selectedVariantIndex } = selectedOptimization

  if (selectedVariantIndex === 0) {
    logger.debug(`Resolved optimization entry for entry ${entry.sys.id} is baseline`)
    return resolveTo(entry)
  }

  const selectedVariant = OptimizedEntryResolver.getSelectedVariant({
    optimizedEntry: entry,
    optimizationEntry,
    selectedVariantIndex,
  })

  if (!selectedVariant) {
    logger.warn(
      `${RESOLUTION_WARNING_BASE} could not find a valid replacement variant entry for ${entry.sys.id}`,
    )
    return resolveTo(entry)
  }

  // Detect an empty variant by id === ''. Two forms exist in CDA nt_config:
  // { id: '', hidden: true }  — author explicitly chose "Use empty variant" in the UI
  // { id: '', hidden: false } — unfilled placeholder, added/unlinked but not configured
  // Both produce isEmptyVariant: true. The `hidden` flag is not used because the
  // Experience API strips it before runtime; id === '' is the stable invariant.
  if (selectedVariant.id === '') {
    logger.debug(
      `Entry ${entry.sys.id} resolved to empty variant at index ${selectedVariantIndex} — rendering nothing`,
    )
    return resolveTo(entry, selectedVariant, true)
  }

  const selectedVariantEntry = OptimizedEntryResolver.getSelectedVariantEntry<S, M, L>({
    optimizedEntry: entry,
    optimizationEntry,
    selectedVariant,
  })

  if (!selectedVariantEntry) {
    logger.warn(
      `${RESOLUTION_WARNING_BASE} could not find a valid replacement variant entry for ${entry.sys.id}`,
    )
    return resolveTo(entry, selectedVariant)
  }

  logger.debug(
    `Entry ${entry.sys.id} has been resolved to variant entry ${selectedVariantEntry.sys.id}`,
  )
  return resolveTo(selectedVariantEntry, selectedVariant)
}

/**
 * Resolve an optimized Contentful entry to the correct variant for the current
 * selections.
 *
 * @public
 * @remarks
 * Given a baseline {@link OptimizedEntry} and a set of selected optimizations
 * (variants per experience), this resolver finds the matching replacement variant
 * for the component configured against the baseline entry.
 *
 * **Variant indexing**: `variantIndex` in {@link SelectedOptimization} is treated as
 * 1‑based (index 1 = first variant). A value of `0` indicates baseline.
 */
const OptimizedEntryResolver = {
  /**
   * Find the optimization entry corresponding to one of the selected experiences.
   *
   * @param params - Object containing the baseline optimized entry and the selections.
   * @returns The matching {@link OptimizationEntry}, or `undefined` if not found/invalid.
   * @remarks
   * An optimization entry is an optimization configuration object supplied in an
   * `OptimizedEntry.nt_experiences` array. An optimized entry can relate to
   * multiple optimizations.
   * @example
   * ```ts
   * const optimizationEntry = OptimizedEntryResolver.getOptimizationEntry({
   *   optimizedEntry: entry,
   *   selectedOptimizations
   * })
   * ```
   */
  getOptimizationEntry({
    optimizedEntry,
    selectedOptimizations,
  }: {
    optimizedEntry: OptimizedEntry
    selectedOptimizations: SelectedOptimizationArray
  }): OptimizationEntry | undefined {
    if (!selectedOptimizations.length || !isResolvedOptimizedEntry(optimizedEntry)) return

    const optimizationEntry = optimizedEntry.fields.nt_experiences
      .filter((maybeOptimization) => isResolvedOptimizationEntry(maybeOptimization))
      .find((optimizationEntry) =>
        selectedOptimizations.some(
          ({ experienceId }) => experienceId === optimizationEntry.fields.nt_experience_id,
        ),
      )

    return optimizationEntry
  },

  /**
   * Look up the selection metadata for a specific optimization entry.
   *
   * @param params - Object with the target optimization entry and selections.
   * @returns The matching {@link SelectedOptimization}, if present.
   * @remarks
   * Selected optimizations are supplied by the Experience API in the
   * `experiences` response data property.
   * @example
   * ```ts
   * const selectedOptimization = OptimizedEntryResolver.getSelectedOptimization({
   *   optimizationEntry,
   *   selectedOptimizations
   * })
   * ```
   */
  getSelectedOptimization({
    optimizationEntry,
    selectedOptimizations,
  }: {
    optimizationEntry: OptimizationEntry
    selectedOptimizations: SelectedOptimizationArray
  }): SelectedOptimization | undefined {
    if (!selectedOptimizations.length || !isResolvedOptimizationEntry(optimizationEntry)) return

    const selectedOptimization = selectedOptimizations.find(
      ({ experienceId }) => experienceId === optimizationEntry.fields.nt_experience_id,
    )

    return selectedOptimization
  },

  /**
   * Get the replacement variant config for the given selection index.
   *
   * @param params - Baseline entry, optimization entry, and 1‑based variant index.
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
  getSelectedVariant({
    optimizedEntry,
    optimizationEntry,
    selectedVariantIndex,
  }: {
    optimizedEntry: OptimizedEntry
    optimizationEntry: OptimizationEntry
    selectedVariantIndex: number
  }): EntryReplacementVariant | undefined {
    if (
      !isResolvedOptimizedEntry(optimizedEntry) ||
      !isResolvedOptimizationEntry(optimizationEntry)
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
  >({
    optimizedEntry,
    optimizationEntry,
    selectedVariant,
  }: {
    optimizedEntry: Entry<S, M, L>
    optimizationEntry: OptimizationEntry
    selectedVariant: EntryReplacementVariant
  }): Entry<S, M, L> | undefined {
    if (
      !isResolvedOptimizationEntry(optimizationEntry) ||
      !isEntryReplacementVariant(selectedVariant)
    )
      return

    const selectedVariantReference = optimizationEntry.fields.nt_variants?.find(
      (variant) => variant.sys.id === selectedVariant.id,
    )

    if (!isResolvedEntryForBaseline(selectedVariantReference, optimizedEntry)) return

    return selectedVariantReference
  },

  resolve,
  resolveWithContext,
}

export default OptimizedEntryResolver
