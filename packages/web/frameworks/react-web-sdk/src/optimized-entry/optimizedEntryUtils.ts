import type {
  OptimizedEntryLoadingTargetDisplay,
  OptimizedEntryMetadata,
} from '@contentful/optimization-web/presentation'
import type { ChainModifiers, EntrySkeletonType, LocaleCode } from 'contentful'
import type { CSSProperties, ReactNode } from 'react'
import type { OptimizationSdk } from '../context/OptimizationContext'

export type LoadingFallback = ReactNode | (() => ReactNode)
export type ErrorFallback = ReactNode | ((error: Error) => ReactNode)
export type WrapperElement = 'div' | 'span'
export interface OptimizedEntryRenderContext<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> extends OptimizedEntryMetadata<S, M, L> {
  readonly getMergeTagValue: OptimizationSdk['getMergeTagValue']
}
export type RenderProp<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = (
  resolvedEntry: OptimizedEntryMetadata<S, M, L>['entry'],
  context: OptimizedEntryRenderContext<S, M, L>,
) => ReactNode
export type OptimizedEntryChildren<
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = ReactNode | RenderProp<S, M, L>

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

export function resolveChildren<
  S extends EntrySkeletonType,
  M extends ChainModifiers,
  L extends LocaleCode,
>(
  children: OptimizedEntryChildren<S, M, L>,
  entry: OptimizedEntryMetadata<S, M, L>['entry'],
  context: OptimizedEntryRenderContext<S, M, L>,
): ReactNode {
  if (typeof children !== 'function') {
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
