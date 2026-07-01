import type {
  OptimizedEntryLoadingTargetDisplay,
  OptimizedEntryMetadata,
} from '@contentful/optimization-web/presentation'
import type { Entry } from 'contentful'
import type { CSSProperties, ReactNode } from 'react'

export type LoadingFallback = ReactNode | (() => ReactNode)
export type ErrorFallback = ReactNode | ((error: Error) => ReactNode)
export type WrapperElement = 'div' | 'span'
export type RenderProp = (resolvedEntry: Entry, metadata?: OptimizedEntryMetadata) => ReactNode
export type OptimizedEntryChildren = ReactNode | RenderProp

export type LoadingLayoutTargetStyle = Pick<CSSProperties, 'display' | 'visibility'>

export function resolveLoadingFallback(loadingFallback: LoadingFallback | undefined): ReactNode {
  if (typeof loadingFallback === 'function') {
    return loadingFallback()
  }

  return loadingFallback
}

export function resolveErrorFallback(
  errorFallback: ErrorFallback | undefined,
  error: Error,
): ReactNode {
  if (typeof errorFallback === 'function') {
    return errorFallback(error)
  }

  return errorFallback
}

export function resolveChildren(
  children: OptimizedEntryChildren,
  entry: Entry,
  metadata?: OptimizedEntryMetadata,
): ReactNode {
  if (typeof children !== 'function') {
    return children
  }

  return children(entry, metadata)
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
