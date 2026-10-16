import {
  createHandoffFromSelections as createCoreHandoffFromSelections,
  createPublicPermutationCacheMetadata as createCorePublicPermutationCacheMetadata,
  createOptimizationCacheKey,
  type ChangeArray,
  type ManagedEntryHandoff,
  type OptimizationCacheMetadata,
  type OptimizationHandoff,
  type PublicPermutationOptimizationCacheMetadata,
  type SelectedOptimizationArray,
} from '@contentful/optimization-react-web/core-sdk'
import type {
  AnalyticsOptimizationHandoff,
  BrowserOptimizationHandoff,
  ContentOptimizationHandoff,
  ContentOptimizationHydrationMode,
  OptimizationHydrationMode,
} from '@contentful/optimization-react-web/handoff'
import { validateNextjsPublicPermutationCacheTags } from './cache-tags'

export type {
  AnalyticsOptimizationHandoff,
  BrowserOptimizationHandoff,
  ContentOptimizationHandoff,
  ContentOptimizationHydrationMode,
  OptimizationHydrationMode,
} from '@contentful/optimization-react-web/handoff'

export { createOptimizationCacheKey }

export type NextjsInitialPageEvent = 'emit' | 'skip'

export interface NextjsBrowserHandoffMetadata {
  readonly hydration: OptimizationHydrationMode
  readonly initialPageEvent: NextjsInitialPageEvent
}

export interface NextjsCreateHandoffFromSelectionsOptions extends NextjsBrowserHandoffMetadata {
  readonly selectedOptimizations: SelectedOptimizationArray
  readonly changes?: ChangeArray
  readonly entries?: readonly ManagedEntryHandoff[]
  readonly cache: OptimizationCacheMetadata
}

export interface NextjsCreatePublicPermutationHandoffOptions extends NextjsBrowserHandoffMetadata {
  readonly permutationKey: string
  readonly cacheVersion?: string
  readonly locale?: string
  readonly entryIds?: readonly string[]
  readonly selectedOptimizations: SelectedOptimizationArray
  readonly changes?: ChangeArray
  readonly entries?: readonly ManagedEntryHandoff[]
  readonly tags?: readonly string[]
}

type PublicPermutationCacheMetadataInput = Parameters<
  typeof createCorePublicPermutationCacheMetadata
>[0]

export function createPublicPermutationCacheMetadata(
  input: PublicPermutationCacheMetadataInput,
): PublicPermutationOptimizationCacheMetadata {
  validateNextjsPublicPermutationCacheTags(input.tags)

  return createCorePublicPermutationCacheMetadata(input)
}

export function addBrowserHandoffMetadata(
  handoff: OptimizationHandoff,
  metadata: NextjsBrowserHandoffMetadata & { readonly hydration: 'analytics-only' },
): AnalyticsOptimizationHandoff
export function addBrowserHandoffMetadata(
  handoff: OptimizationHandoff,
  metadata: NextjsBrowserHandoffMetadata & {
    readonly hydration: ContentOptimizationHydrationMode
  },
): ContentOptimizationHandoff
export function addBrowserHandoffMetadata(
  handoff: OptimizationHandoff,
  metadata: NextjsBrowserHandoffMetadata,
): BrowserOptimizationHandoff
export function addBrowserHandoffMetadata(
  handoff: OptimizationHandoff,
  metadata: NextjsBrowserHandoffMetadata,
): BrowserOptimizationHandoff {
  const browserHandoff: BrowserOptimizationHandoff = {
    ...handoff,
    hydration: metadata.hydration,
    initialPageEvent: metadata.initialPageEvent,
  }

  return browserHandoff
}

export function createHandoffFromSelections(
  input: NextjsCreateHandoffFromSelectionsOptions & { readonly hydration: 'analytics-only' },
): AnalyticsOptimizationHandoff
export function createHandoffFromSelections(
  input: NextjsCreateHandoffFromSelectionsOptions & {
    readonly hydration: ContentOptimizationHydrationMode
  },
): ContentOptimizationHandoff
export function createHandoffFromSelections(
  input: NextjsCreateHandoffFromSelectionsOptions,
): BrowserOptimizationHandoff
export function createHandoffFromSelections(
  input: NextjsCreateHandoffFromSelectionsOptions,
): BrowserOptimizationHandoff {
  const { hydration, initialPageEvent, selectedOptimizations, changes, entries, cache } = input
  if (cache.scope === 'public-permutation') validateNextjsPublicPermutationCacheTags(cache.tags)

  const handoff = createCoreHandoffFromSelections({
    cache,
    ...(changes === undefined ? {} : { changes }),
    ...(entries === undefined ? {} : { entries }),
    selectedOptimizations,
  })

  return addBrowserHandoffMetadata(handoff, { hydration, initialPageEvent })
}

export function createPublicPermutationHandoff(
  input: NextjsCreatePublicPermutationHandoffOptions & { readonly hydration: 'analytics-only' },
): AnalyticsOptimizationHandoff
export function createPublicPermutationHandoff(
  input: NextjsCreatePublicPermutationHandoffOptions & {
    readonly hydration: ContentOptimizationHydrationMode
  },
): ContentOptimizationHandoff
export function createPublicPermutationHandoff(
  input: NextjsCreatePublicPermutationHandoffOptions,
): BrowserOptimizationHandoff
export function createPublicPermutationHandoff(
  input: NextjsCreatePublicPermutationHandoffOptions,
): BrowserOptimizationHandoff {
  return createHandoffFromSelections({
    cache: createPublicPermutationCacheMetadata(input),
    changes: input.changes,
    entries: input.entries,
    hydration: input.hydration,
    initialPageEvent: input.initialPageEvent,
    selectedOptimizations: input.selectedOptimizations,
  })
}
