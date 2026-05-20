import type { SelectedOptimization } from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import type { CSSProperties, ReactNode } from 'react'

export type LoadingFallback = ReactNode | (() => ReactNode)
export type WrapperElement = 'div' | 'span'
export type RenderProp = (resolvedEntry: Entry) => ReactNode
export type OptimizedEntryChildren = ReactNode | RenderProp

export interface LoadingRenderState {
  hideLoadingLayoutTarget: boolean
  isServerRender: boolean
  loadingContent: ReactNode
  showLoadingFallback: boolean
}

export interface TrackingAttributeOptions {
  trackClicks?: boolean
  trackHovers?: boolean
  trackViews?: boolean
}

export type LoadingLayoutTargetStyle = Pick<CSSProperties, 'display' | 'visibility'>

type TrackingAttributeValue = string | boolean | number | undefined

export function resolveLoadingFallback(loadingFallback: LoadingFallback | undefined): ReactNode {
  if (typeof loadingFallback === 'function') {
    return loadingFallback()
  }

  return loadingFallback
}

export function isRenderProp(children: OptimizedEntryChildren): children is RenderProp {
  return typeof children === 'function'
}

export function resolveChildren(children: OptimizedEntryChildren, entry: Entry): ReactNode {
  if (!isRenderProp(children)) {
    return children
  }

  return children(entry)
}

export function hasOptimizationReferences(entry: Entry): boolean {
  return Array.isArray(entry.fields.nt_experiences) && entry.fields.nt_experiences.length > 0
}

function resolveDuplicationScope(
  selectedOptimization: SelectedOptimization | undefined,
): string | undefined {
  const candidate =
    selectedOptimization &&
    typeof selectedOptimization === 'object' &&
    'duplicationScope' in selectedOptimization
      ? selectedOptimization.duplicationScope
      : undefined

  if (typeof candidate !== 'string') {
    return undefined
  }

  return candidate.trim() ? candidate : undefined
}

export function resolveShouldLiveUpdate(params: {
  previewPanelVisible: boolean
  componentLiveUpdates: boolean | undefined
  globalLiveUpdates: boolean
}): boolean {
  const { previewPanelVisible, componentLiveUpdates, globalLiveUpdates } = params

  if (previewPanelVisible) {
    return true
  }

  return componentLiveUpdates ?? globalLiveUpdates
}

export function resolveTrackingAttributes(
  resolvedData: ResolvedData<EntrySkeletonType>,
  options: TrackingAttributeOptions = {},
): Record<string, TrackingAttributeValue> {
  const {
    selectedOptimization,
    entry: {
      sys: { id: entryId },
    },
  } = resolvedData
  const { trackClicks, trackHovers, trackViews } = options

  return {
    'data-ctfl-duplication-scope': resolveDuplicationScope(selectedOptimization),
    'data-ctfl-entry-id': entryId,
    'data-ctfl-optimization-id': selectedOptimization?.experienceId,
    'data-ctfl-sticky': selectedOptimization?.sticky,
    'data-ctfl-track-clicks': trackClicks,
    'data-ctfl-track-hovers': trackHovers,
    'data-ctfl-track-views': trackViews,
    'data-ctfl-variant-index': selectedOptimization?.variantIndex ?? 0,
  }
}

export function resolveLoadingLayoutTargetStyle(
  wrapperElement: WrapperElement,
  isInvisible: boolean,
): LoadingLayoutTargetStyle {
  return {
    display: wrapperElement === 'span' ? 'inline' : 'block',
    visibility: isInvisible ? 'hidden' : undefined,
  }
}

export function resolveLoadingRenderState(params: {
  baselineChildren: OptimizedEntryChildren
  baselineEntry: Entry
  hasCustomLoadingFallback: boolean
  isLoading: boolean
  resolvedLoadingFallback: ReactNode
  sdkInitialized: boolean
}): LoadingRenderState {
  const {
    baselineChildren,
    baselineEntry,
    hasCustomLoadingFallback,
    isLoading,
    resolvedLoadingFallback,
    sdkInitialized,
  } = params
  const isServerRender = typeof window === 'undefined'
  const showLoadingFallback = isLoading || (isServerRender && !sdkInitialized)
  const loadingContent = hasCustomLoadingFallback
    ? !sdkInitialized && !isServerRender
      ? resolveChildren(baselineChildren, baselineEntry)
      : resolvedLoadingFallback
    : resolveChildren(baselineChildren, baselineEntry)
  const hideLoadingLayoutTarget = !hasCustomLoadingFallback || isServerRender || !sdkInitialized

  return {
    hideLoadingLayoutTarget,
    isServerRender,
    loadingContent,
    showLoadingFallback,
  }
}
