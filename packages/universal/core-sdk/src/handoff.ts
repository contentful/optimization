import type { ChainModifiers, Entry, EntrySkeletonType, LocaleCode } from 'contentful'
import type {
  ChangeArray,
  Profile,
  SelectedOptimization,
  SelectedOptimizationArray,
} from './api-schemas'
import type { FetchOptimizedEntryResult, ManagedEntryHandoff } from './CoreBase'
import OptimizedEntryResolver from './resolvers/OptimizedEntryResolver'

const SELECTION_FINGERPRINT_PREFIX = 'ctfl-opt-selection:v1'
const CACHE_KEY_PREFIX = 'ctfl-opt-cache:v1'

/**
 * Profile-optional optimization state used by explicit handoff and snapshot paths.
 *
 * @public
 */
export interface OptimizationSelectionState {
  /** Selected optimizations used for content and analytics resolution. */
  readonly selectedOptimizations?: SelectedOptimizationArray
  /** Custom flag changes derived from selected optimizations. */
  readonly changes?: ChangeArray
  /** Full profile state when the render was backed by a real Experience API response. */
  readonly profile?: Profile
}

/**
 * Cache scope for server, static, and edge optimization handoffs.
 *
 * @public
 */
export type OptimizationCacheScope = 'private-request' | 'public-permutation' | 'static'

/**
 * Cache metadata attached to a framework-neutral optimization handoff.
 *
 * @public
 */
export interface OptimizationCacheMetadata {
  /** Cache safety scope for the rendered output. */
  readonly scope: OptimizationCacheScope
  /** Customer-owned cache key for cacheable public permutations. */
  readonly key?: string
  /** Optional customer-owned tags for framework or CDN invalidation. */
  readonly tags?: readonly string[]
}

/**
 * Framework-neutral optimization state passed from server, static, or edge rendering.
 *
 * @public
 */
export interface OptimizationHandoff {
  /** Optimization state used by the render. */
  readonly state?: OptimizationSelectionState
  /** Baseline managed-entry snapshots preserved for downstream hydration. */
  readonly entries?: readonly ManagedEntryHandoff[]
  /** Cache metadata for the rendered output. */
  readonly cache: OptimizationCacheMetadata
}

/**
 * Warning code returned by {@link getOptimizationCacheSafetyWarnings}.
 *
 * @public
 */
export type OptimizationCacheSafetyWarningCode =
  | 'profile-state-in-public-cache'
  | 'missing-public-permutation-cache-key'

/**
 * Cache-safety warning for an optimization handoff.
 *
 * @public
 */
export interface OptimizationCacheSafetyWarning {
  /** Stable warning code. */
  readonly code: OptimizationCacheSafetyWarningCode
  /** Human-readable warning message. */
  readonly message: string
  /** Stable path to the unsafe or missing handoff field. */
  readonly path?: readonly string[]
}

function encodeKeyPart(value: string | number | boolean): string {
  return encodeURIComponent(String(value))
}

function formatVariants(variants: SelectedOptimization['variants']): string {
  const entries = Object.entries(variants).sort(([left], [right]) => left.localeCompare(right))

  if (entries.length === 0) return '-'

  return entries
    .map(
      ([baselineEntryId, variantEntryId]) =>
        `${encodeKeyPart(baselineEntryId)}=${encodeKeyPart(variantEntryId)}`,
    )
    .join(',')
}

function formatSelection(selection: SelectedOptimization): string {
  return [
    `experience=${encodeKeyPart(selection.experienceId)}`,
    `variant=${encodeKeyPart(selection.variantIndex)}`,
    `sticky=${selection.sticky === true ? 'true' : 'false'}`,
    `variants=${formatVariants(selection.variants)}`,
  ].join(';')
}

function normalizeSelections(
  selectedOptimizations: SelectedOptimizationArray,
): SelectedOptimizationArray {
  return [...selectedOptimizations].sort((left, right) =>
    formatSelection(left).localeCompare(formatSelection(right)),
  )
}

/**
 * Create a deterministic, versioned fingerprint for selected optimization state.
 *
 * @param selectedOptimizations - Selected optimization outcomes to fingerprint.
 * @returns Readable v1 fingerprint with normalized selection and variant-map order.
 *
 * @public
 */
export function createSelectionFingerprint(
  selectedOptimizations: SelectedOptimizationArray | undefined,
): string {
  if (selectedOptimizations === undefined) return `${SELECTION_FINGERPRINT_PREFIX}:none`
  if (selectedOptimizations.length === 0) return `${SELECTION_FINGERPRINT_PREFIX}:empty`

  return `${SELECTION_FINGERPRINT_PREFIX}:${normalizeSelections(selectedOptimizations)
    .map(formatSelection)
    .join('|')}`
}

/**
 * Create a deterministic, versioned cache key for an optimization render.
 *
 * @param input - Cache scope and optional render dimensions.
 * @returns Readable v1 cache key containing scope, locale, entry IDs, and selection fingerprint.
 *
 * @public
 */
export function createOptimizationCacheKey(input: {
  readonly scope: OptimizationCacheScope
  readonly selectedOptimizations?: SelectedOptimizationArray
  readonly locale?: string
  readonly entryIds?: readonly string[]
}): string {
  const entryIds = [...(input.entryIds ?? [])].sort((left, right) => left.localeCompare(right))

  return [
    CACHE_KEY_PREFIX,
    `scope=${encodeKeyPart(input.scope)}`,
    `locale=${input.locale === undefined ? '-' : encodeKeyPart(input.locale)}`,
    `entries=${entryIds.length === 0 ? '-' : entryIds.map(encodeKeyPart).join(',')}`,
    `selection=${createSelectionFingerprint(input.selectedOptimizations)}`,
  ].join(':')
}

/**
 * Resolve multiple baseline entries with a shared selected-optimization array.
 *
 * @param input - Baseline entries and selected optimization outcomes.
 * @returns Resolved entries in the same order as `input.entries`, each with its baseline entry.
 *
 * @public
 */
export function resolveEntriesForSelections<
  S extends EntrySkeletonType = EntrySkeletonType,
  L extends LocaleCode = LocaleCode,
>(input: {
  readonly entries: ReadonlyArray<Entry<S, undefined, L>>
  readonly selectedOptimizations?: SelectedOptimizationArray
}): ReadonlyArray<FetchOptimizedEntryResult<S, undefined, L>>
export function resolveEntriesForSelections<
  S extends EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(input: {
  readonly entries: ReadonlyArray<Entry<S, M, L>>
  readonly selectedOptimizations?: SelectedOptimizationArray
}): ReadonlyArray<FetchOptimizedEntryResult<S, M, L>>
export function resolveEntriesForSelections<
  S extends EntrySkeletonType,
  M extends ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(input: {
  readonly entries: ReadonlyArray<Entry<S, M, L>>
  readonly selectedOptimizations?: SelectedOptimizationArray
}): ReadonlyArray<FetchOptimizedEntryResult<S, M, L>> {
  return input.entries.map((baselineEntry) => ({
    baselineEntry,
    ...OptimizedEntryResolver.resolve<S, M, L>(baselineEntry, input.selectedOptimizations),
  }))
}

/**
 * Create a framework-neutral handoff from customer-owned selected optimizations.
 *
 * @param input - Selection state, optional baseline entry snapshots, and cache metadata.
 * @returns Core optimization handoff without browser hydration or page-event metadata.
 *
 * @public
 */
export function createHandoffFromSelections(input: {
  readonly selectedOptimizations: SelectedOptimizationArray
  readonly changes?: ChangeArray
  readonly entries?: readonly ManagedEntryHandoff[]
  readonly cache: OptimizationCacheMetadata
}): OptimizationHandoff {
  if (!Array.isArray(input.selectedOptimizations)) {
    throw new TypeError(
      'createHandoffFromSelections requires selectedOptimizations to be an array.',
    )
  }

  return {
    cache: input.cache,
    ...(input.entries === undefined ? {} : { entries: input.entries }),
    state: {
      selectedOptimizations: input.selectedOptimizations,
      ...(input.changes === undefined ? {} : { changes: input.changes }),
    },
  }
}

/**
 * Return cache-safety warnings for an optimization handoff.
 *
 * @param handoff - Optimization handoff to inspect.
 * @returns Warnings only; this helper does not throw or block rendering.
 *
 * @public
 */
export function getOptimizationCacheSafetyWarnings(
  handoff: OptimizationHandoff,
): readonly OptimizationCacheSafetyWarning[] {
  const warnings: OptimizationCacheSafetyWarning[] = []
  const { cache, state } = handoff

  if (
    (cache.scope === 'public-permutation' || cache.scope === 'static') &&
    state?.profile !== undefined
  ) {
    warnings.push({
      code: 'profile-state-in-public-cache',
      message: 'Profile state should not be included in public or static optimization caches.',
      path: ['state', 'profile'],
    })
  }

  if (cache.scope === 'public-permutation' && !cache.key) {
    warnings.push({
      code: 'missing-public-permutation-cache-key',
      message: 'Public optimization permutations should include cache.key.',
      path: ['cache', 'key'],
    })
  }

  return warnings
}
