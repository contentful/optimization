import {
  createHandoffFromSelections as createCoreHandoffFromSelections,
  createOptimizationCacheKey,
  type ChangeArray,
  type ManagedEntryHandoff,
  type OptimizationCacheMetadata,
  type OptimizationHandoff,
  type SelectedOptimizationArray,
} from '@contentful/optimization-react-web/core-sdk'
import type {
  AnalyticsOptimizationHandoff,
  BrowserOptimizationHandoff,
  ContentOptimizationHandoff,
  ContentOptimizationHydrationMode,
  OptimizationHydrationMode,
} from '@contentful/optimization-react-web/handoff'

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
  const handoff = createCoreHandoffFromSelections({
    cache,
    ...(changes === undefined ? {} : { changes }),
    ...(entries === undefined ? {} : { entries }),
    selectedOptimizations,
  })

  return addBrowserHandoffMetadata(handoff, { hydration, initialPageEvent })
}
