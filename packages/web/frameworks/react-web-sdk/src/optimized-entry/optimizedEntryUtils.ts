import type { OptimizedEntryLoadingTargetDisplay } from '@contentful/optimization-web/sdk-support'
import type { Entry } from 'contentful'
import type { CSSProperties, ReactNode } from 'react'

export type LoadingFallback = ReactNode | (() => ReactNode)
export type WrapperElement = 'div' | 'span'
export type RenderProp = (resolvedEntry: Entry) => ReactNode
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

export function resolveChildren(children: OptimizedEntryChildren, entry: Entry): ReactNode {
  if (!isRenderProp(children)) {
    return children
  }

  return children(entry)
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
