import type { SelectedPersonalization } from '@contentful/optimization-web/api-schemas'
import type { ResolvedData } from '@contentful/optimization-web/core-sdk'
import type { Entry, EntrySkeletonType } from 'contentful'
import type { ReactNode } from 'react'

export type LoadingFallback = ReactNode | (() => ReactNode)
export type WrapperElement = 'div' | 'span'
export type RenderProp = (resolvedEntry: Entry) => ReactNode
export type OptimizedEntryChildren = ReactNode | RenderProp

export interface LoadingRenderState {
  isInvisibleLoading: boolean
  isServerRender: boolean
  loadingContent: ReactNode
  showLoadingFallback: boolean
}

const LOADING_LAYOUT_TARGET_STYLE = Object.freeze({
  display: 'block' as const,
})
const LOADING_LAYOUT_TARGET_STYLE_INLINE = Object.freeze({
  display: 'inline' as const,
})
const LOADING_LAYOUT_TARGET_STYLE_HIDDEN = Object.freeze({
  display: 'block' as const,
  visibility: 'hidden' as const,
})
const LOADING_LAYOUT_TARGET_STYLE_INLINE_HIDDEN = Object.freeze({
  display: 'inline' as const,
  visibility: 'hidden' as const,
})

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

export function hasPersonalizationReferences(entry: Entry): boolean {
  const { fields } = entry
  const { nt_experiences: ntExperiences } = fields

  if (!Array.isArray(ntExperiences)) {
    return false
  }

  return ntExperiences.length > 0
}

function resolveDuplicationScope(
  personalization: SelectedPersonalization | undefined,
): string | undefined {
  const candidate =
    personalization && typeof personalization === 'object' && 'duplicationScope' in personalization
      ? personalization.duplicationScope
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
): Record<string, string | undefined> {
  const {
    personalization,
    entry: {
      sys: { id: entryId },
    },
  } = resolvedData

  return {
    'data-ctfl-duplication-scope': resolveDuplicationScope(personalization),
    'data-ctfl-entry-id': entryId,
    'data-ctfl-personalization-id': personalization?.experienceId,
    'data-ctfl-sticky':
      personalization?.sticky === undefined ? undefined : String(personalization.sticky),
    'data-ctfl-variant-index': String(personalization?.variantIndex ?? 0),
  }
}

export function resolveLoadingLayoutTargetStyle(
  wrapperElement: WrapperElement,
  isInvisible: boolean,
):
  | typeof LOADING_LAYOUT_TARGET_STYLE
  | typeof LOADING_LAYOUT_TARGET_STYLE_INLINE
  | typeof LOADING_LAYOUT_TARGET_STYLE_HIDDEN
  | typeof LOADING_LAYOUT_TARGET_STYLE_INLINE_HIDDEN {
  if (isInvisible) {
    if (wrapperElement === 'span') {
      return LOADING_LAYOUT_TARGET_STYLE_INLINE_HIDDEN
    }

    return LOADING_LAYOUT_TARGET_STYLE_HIDDEN
  }

  if (wrapperElement === 'span') {
    return LOADING_LAYOUT_TARGET_STYLE_INLINE
  }

  return LOADING_LAYOUT_TARGET_STYLE
}

export function resolveLoadingRenderState(params: {
  baselineChildren: OptimizedEntryChildren
  baselineEntry: Entry
  isLoading: boolean
  resolvedLoadingFallback: ReactNode
  sdkInitialized: boolean
}): LoadingRenderState {
  const { baselineChildren, baselineEntry, isLoading, resolvedLoadingFallback, sdkInitialized } =
    params
  const isServerRender = typeof window === 'undefined'
  const isInvisibleLoading = isLoading && !sdkInitialized
  const showLoadingFallback = isLoading || (isServerRender && !sdkInitialized)
  const loadingContent =
    !sdkInitialized && !isServerRender
      ? resolveChildren(baselineChildren, baselineEntry)
      : resolvedLoadingFallback

  return {
    isInvisibleLoading,
    isServerRender,
    loadingContent,
    showLoadingFallback,
  }
}
