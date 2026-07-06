import type { OptimizedEntryLoadingTargetDisplay } from '@contentful/optimization-web/presentation'
import type { Entry } from 'contentful'
import type { CSSProperties, ReactNode } from 'react'
import type { OptimizationSdk } from '../context/OptimizationContext'

export type LoadingFallback = ReactNode | (() => ReactNode)
export type WrapperElement = 'div' | 'span'
export interface OptimizedEntryRenderContext {
  readonly getMergeTagValue: OptimizationSdk['getMergeTagValue']
}
export type RenderProp = (resolvedEntry: Entry, context: OptimizedEntryRenderContext) => ReactNode
export type OptimizedEntryChildren = ReactNode | RenderProp

export type LoadingLayoutTargetStyle = Pick<CSSProperties, 'display' | 'visibility'>

export function resolveLoadingFallback(loadingFallback: LoadingFallback | undefined): ReactNode {
  if (typeof loadingFallback === 'function') {
    return loadingFallback()
  }

  return loadingFallback
}

export function isRenderProp(children: OptimizedEntryChildren): children is RenderProp {
  return typeof children === 'function'
}

export function resolveChildren(
  children: OptimizedEntryChildren,
  entry: Entry,
  context: OptimizedEntryRenderContext,
): ReactNode {
  if (!isRenderProp(children)) {
    return children
  }

  return children(entry, context)
}

export function resolveLoadingLayoutTargetStyle(
  targetDisplay: OptimizedEntryLoadingTargetDisplay,
  isInvisible: boolean,
): LoadingLayoutTargetStyle {
  return {
    display: targetDisplay,
    visibility: isInvisible ? 'hidden' : undefined,
  }
}
