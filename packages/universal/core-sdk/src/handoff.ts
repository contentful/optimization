import type { ChainModifiers, EntrySkeletonType, LocaleCode } from 'contentful'
import type {
  ChangeArray,
  OptimizationData,
  Profile,
  SelectedOptimization,
  SelectedOptimizationArray,
} from './api-schemas'
import type { FetchOptimizedEntryResult, ManagedEntryHandoff } from './CoreBase'
import type { ExperiencePreview } from './CoreStatelessRequest'
import type { OptimizationReplayEnvelope } from './replay'
import OptimizedEntryResolver, { type EntryFor } from './resolvers/OptimizedEntryResolver'

const SELECTION_FINGERPRINT_PREFIX = 'ctfl-opt-selection:v1'
const CACHE_KEY_PREFIX = 'ctfl-opt-cache:v1'

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

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
 * Return whether optimization state includes a field as its own property.
 *
 * @param state - Optimization state to inspect.
 * @param field - Optimization state field to check.
 * @returns `true` when `field` is present, including when its value is `undefined`.
 *
 * @public
 */
export function hasOptimizationSelectionStateField(
  state: Readonly<OptimizationSelectionState>,
  field: keyof OptimizationSelectionState,
): boolean {
  return Object.prototype.hasOwnProperty.call(state, field)
}

/**
 * Merge sparse optimization state while preserving own-property `undefined` clears.
 *
 * @param previous - State visible before a sparse update.
 * @param next - Sparse update returned by a state interceptor or hydration source.
 * @returns Merged optimization state.
 *
 * @public
 */
export function mergeOptimizationSelectionState(
  previous: Readonly<OptimizationSelectionState>,
  next: OptimizationSelectionState,
): OptimizationSelectionState {
  return {
    ...previous,
    ...(hasOptimizationSelectionStateField(next, 'selectedOptimizations')
      ? { selectedOptimizations: next.selectedOptimizations }
      : {}),
    ...(hasOptimizationSelectionStateField(next, 'changes') ? { changes: next.changes } : {}),
    ...(hasOptimizationSelectionStateField(next, 'profile') ? { profile: next.profile } : {}),
  }
}

/**
 * Cache scope for server, static, and edge optimization handoffs.
 *
 * @public
 */
export type OptimizationCacheScope = 'private-request' | 'public-permutation' | 'static'

/**
 * Cache metadata for request-bound private optimization output.
 *
 * @public
 */
export interface PrivateRequestOptimizationCacheMetadata {
  /** Cache safety scope for the rendered output. */
  readonly scope: 'private-request'
  /** Optional customer-owned cache key for framework or CDN caches. */
  readonly key?: string
  /** Optional customer-owned tags for framework or CDN invalidation. */
  readonly tags?: readonly string[]
}

/**
 * Cache metadata for a cacheable public optimization permutation.
 *
 * @public
 */
export interface PublicPermutationOptimizationCacheMetadata {
  /** Cache safety scope for the rendered output. */
  readonly scope: 'public-permutation'
  /** Customer-owned cache key for this public permutation. */
  readonly key: string
  /** Optional customer-owned tags for framework or CDN invalidation. */
  readonly tags?: readonly string[]
}

/**
 * Cache metadata for static optimization output that does not include profile state.
 *
 * @public
 */
export interface StaticOptimizationCacheMetadata {
  /** Cache safety scope for the rendered output. */
  readonly scope: 'static'
  /** Optional customer-owned cache key for framework or CDN caches. */
  readonly key?: string
  /** Optional customer-owned tags for framework or CDN invalidation. */
  readonly tags?: readonly string[]
}

/**
 * Cache metadata attached to a framework-neutral optimization handoff.
 *
 * @public
 */
export type OptimizationCacheMetadata =
  | PrivateRequestOptimizationCacheMetadata
  | PublicPermutationOptimizationCacheMetadata
  | StaticOptimizationCacheMetadata

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
  /**
   * Private replay instructions created by the SDK for a browser continuation.
   * Public and static handoffs must not carry replay instructions.
   */
  readonly replay?: OptimizationReplayEnvelope
}

/** Presentation policy carried by content handoffs. @public */
export type ContentOptimizationHydrationMode = 'preserve-server' | 'client-only-hidden-until-ready'

/** Presentation policy carried by content or analytics-only handoffs. @public */
export type OptimizationHydrationMode = ContentOptimizationHydrationMode | 'analytics-only'

/** A handoff with its caller-selected presentation mode retained in the type. @public */
export type OptimizationHandoffWithHydration<TMode extends OptimizationHydrationMode> =
  OptimizationHandoff & { readonly hydration: TMode }

/** Options for a private handoff from evaluated request data. @public */
export interface CreateRequestHandoffFromDataOptions {
  readonly data?: OptimizationData
  readonly entries?: readonly ManagedEntryHandoff[]
  readonly cache?: PrivateRequestOptimizationCacheMetadata
  readonly hydration?: OptimizationHydrationMode
}

/** Options for a private handoff from an accepted request preview. @public */
export interface CreateRequestHandoffFromPreviewOptions extends Omit<
  CreateRequestHandoffFromDataOptions,
  'data'
> {
  readonly preview: ExperiencePreview
  readonly routeKey?: string
}

/**
 * Warning code returned by {@link getOptimizationCacheSafetyWarnings}.
 *
 * @public
 */
export type OptimizationCacheSafetyWarningCode =
  | 'profile-state-in-public-cache'
  | 'missing-public-permutation-cache-key'
  | 'replay-in-non-private-cache'

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
  const entries = Object.entries(variants).sort(([left], [right]) => compareCodeUnits(left, right))

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
    compareCodeUnits(formatSelection(left), formatSelection(right)),
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
  const entryIds = [...(input.entryIds ?? [])].sort(compareCodeUnits)

  return [
    CACHE_KEY_PREFIX,
    `scope=${encodeKeyPart(input.scope)}`,
    `locale=${input.locale === undefined ? '-' : encodeKeyPart(input.locale)}`,
    `entries=${entryIds.length === 0 ? '-' : entryIds.map(encodeKeyPart).join(',')}`,
    `selection=${createSelectionFingerprint(input.selectedOptimizations)}`,
  ].join(':')
}

/**
 * Create cache metadata for a cacheable public optimization permutation.
 *
 * @param input - Public permutation dimensions and optional framework or CDN tags.
 * @returns Public-permutation cache metadata with a deterministic key.
 *
 * @public
 */
export function createPublicPermutationCacheMetadata(input: {
  readonly permutationKey: string
  readonly cacheVersion?: string
  readonly locale?: string
  readonly entryIds?: readonly string[]
  readonly selectedOptimizations: SelectedOptimizationArray
  readonly tags?: readonly string[]
}): PublicPermutationOptimizationCacheMetadata {
  const optimizationKey = createOptimizationCacheKey({
    ...(input.entryIds === undefined ? {} : { entryIds: input.entryIds }),
    ...(input.locale === undefined ? {} : { locale: input.locale }),
    scope: 'public-permutation',
    selectedOptimizations: input.selectedOptimizations,
  })
  let key = `permutation=${encodeKeyPart(input.permutationKey)}`
  if (input.cacheVersion !== undefined) key += `:version=${encodeKeyPart(input.cacheVersion)}`
  key += `:${optimizationKey}`

  if (input.tags === undefined) return { key, scope: 'public-permutation' }

  return { key, scope: 'public-permutation', tags: input.tags }
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
  readonly entries: ReadonlyArray<EntryFor<S, undefined, L>>
  readonly selectedOptimizations?: SelectedOptimizationArray
}): ReadonlyArray<FetchOptimizedEntryResult<S, undefined, L>>
export function resolveEntriesForSelections<
  S extends EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(input: {
  readonly entries: ReadonlyArray<EntryFor<S, M, L>>
  readonly selectedOptimizations?: SelectedOptimizationArray
}): ReadonlyArray<FetchOptimizedEntryResult<S, M, L>>
export function resolveEntriesForSelections<
  S extends EntrySkeletonType,
  M extends ChainModifiers,
  L extends LocaleCode = LocaleCode,
>(input: {
  readonly entries: ReadonlyArray<EntryFor<S, M, L>>
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

  const handoff: OptimizationHandoff = {
    cache: input.cache,
    ...(input.entries === undefined ? {} : { entries: input.entries }),
    state: {
      selectedOptimizations: input.selectedOptimizations,
      ...(input.changes === undefined ? {} : { changes: input.changes }),
    },
  }

  assertOptimizationCacheSafety(handoff)

  return handoff
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

  if (handoff.replay !== undefined && cache.scope !== 'private-request') {
    warnings.push({
      code: 'replay-in-non-private-cache',
      message:
        'Replay instructions are request-private and must not be included in public or static caches.',
      path: ['replay'],
    })
  }

  return warnings
}

/**
 * Throw when an optimization handoff is unsafe for its cache metadata.
 *
 * @param handoff - Optimization handoff to inspect.
 *
 * @public
 */
export function assertOptimizationCacheSafety(handoff: OptimizationHandoff): void {
  const warnings = getOptimizationCacheSafetyWarnings(handoff)

  if (warnings.length === 0) return

  throw new TypeError(warnings.map((warning) => warning.message).join(' '))
}

function assertPrivateRequestCacheMetadata(
  cache: OptimizationCacheMetadata,
): asserts cache is PrivateRequestOptimizationCacheMetadata {
  if (cache.scope === 'private-request') return

  throw new TypeError(
    'Request handoffs must use private-request cache scope. Use public permutation handoffs for public cache scopes, or a non-request handoff for static output.',
  )
}

/** Create a private request handoff from request-scoped optimization data. @public */
export function createRequestHandoffFromData<TMode extends OptimizationHydrationMode>(
  input: CreateRequestHandoffFromDataOptions & { readonly hydration: TMode },
): OptimizationHandoffWithHydration<TMode>
export function createRequestHandoffFromData(
  input: CreateRequestHandoffFromDataOptions,
): OptimizationHandoff
export function createRequestHandoffFromData(
  input: CreateRequestHandoffFromDataOptions,
): OptimizationHandoff {
  const cache: PrivateRequestOptimizationCacheMetadata = input.cache ?? { scope: 'private-request' }
  assertPrivateRequestCacheMetadata(cache)

  const handoff: OptimizationHandoff = {
    cache,
    ...(input.hydration === undefined ? {} : { hydration: input.hydration }),
    ...(input.entries === undefined ? {} : { entries: input.entries }),
    ...(input.data === undefined
      ? {}
      : {
          state: {
            selectedOptimizations: input.data.selectedOptimizations,
            changes: input.data.changes,
            profile: input.data.profile,
          },
        }),
  }
  return handoff
}

/** Bind an accepted preview replay to a private route handoff. @public */
export function createRequestHandoffFromPreview<TMode extends OptimizationHydrationMode>(
  input: CreateRequestHandoffFromPreviewOptions & { readonly hydration: TMode },
): OptimizationHandoffWithHydration<TMode>
export function createRequestHandoffFromPreview(
  input: CreateRequestHandoffFromPreviewOptions,
): OptimizationHandoff
export function createRequestHandoffFromPreview(
  input: CreateRequestHandoffFromPreviewOptions,
): OptimizationHandoff {
  if (!input.preview.accepted)
    throw new TypeError(
      'Cannot create a request handoff from a blocked initial Experience preview.',
    )

  if (
    input.preview.experience.some((event) => event.type === 'page') &&
    input.routeKey === undefined
  ) {
    throw new TypeError('Page-bearing replay requires a route key.')
  }

  const replay = {
    experience: input.preview.experience,
    insights: input.preview.insights,
    ...(input.routeKey === undefined ? {} : { routeKey: input.routeKey }),
    ...(input.preview.profile === undefined ? {} : { profile: input.preview.profile }),
  } satisfies OptimizationReplayEnvelope

  const handoff: OptimizationHandoff = {
    ...createRequestHandoffFromData({
      cache: input.cache,
      data: input.preview.data,
      entries: input.entries,
      hydration: input.hydration,
    }),
    replay,
  }
  return handoff
}
