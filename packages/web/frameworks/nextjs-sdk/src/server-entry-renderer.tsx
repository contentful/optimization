import type {
  OptimizedEntryProps,
  OptimizedEntryRenderContext,
} from '@contentful/optimization-react-web'
import type { ChainModifiers, EntrySkeletonType, LocaleCode } from 'contentful'
import { createElement, type JSX, type ReactElement, type ReactNode } from 'react'
import {
  getServerTrackingAttributes,
  type ServerTrackingAttributeOptions,
  type ServerTrackingAttributes,
  type ServerTrackingBaselineEntry,
  type ServerTrackingResolvedData,
} from './tracking-attributes'

type ServerRenderProp = (
  entry: ServerTrackingResolvedData['entry'],
  context: OptimizedEntryRenderContext,
) => ReactNode
type ServerOptimizedEntryChildren = ReactNode | ServerRenderProp

export function toServerOptimizedEntryChildren(
  children: OptimizedEntryProps['children'],
): ServerOptimizedEntryChildren
export function toServerOptimizedEntryChildren(
  children: OptimizedEntryProps['children'] | ServerOptimizedEntryChildren,
): OptimizedEntryProps['children'] | ServerOptimizedEntryChildren {
  return children
}

type ServerEntryRendererOwnProps<
  TElement extends keyof JSX.IntrinsicElements,
  S extends EntrySkeletonType,
  M extends ChainModifiers,
  L extends LocaleCode,
> = ServerTrackingAttributeOptions & {
  readonly as?: TElement
  readonly baselineEntry: ServerTrackingBaselineEntry<S, M, L>
  readonly children?: ReactNode
  readonly resolvedData: ServerTrackingResolvedData<S, M, L>
}

type DataCtflAttributeName = `data-ctfl-${string}`

type ServerEntryRendererProps<
  TElement extends keyof JSX.IntrinsicElements = 'div',
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
> = ServerEntryRendererOwnProps<TElement, S, M, L> &
  Omit<
    JSX.IntrinsicElements[TElement],
    keyof ServerEntryRendererOwnProps<TElement, S, M, L> | DataCtflAttributeName
  >

export function renderOptimizedEntryOnServer<
  TElement extends keyof JSX.IntrinsicElements = 'div',
  S extends EntrySkeletonType = EntrySkeletonType,
  M extends ChainModifiers = ChainModifiers,
  L extends LocaleCode = LocaleCode,
>({
  as,
  baselineEntry,
  children,
  clickable,
  hoverDurationUpdateIntervalMs,
  resolvedData,
  trackClicks,
  trackHovers,
  trackViews,
  viewDurationUpdateIntervalMs,
  ...htmlProps
}: ServerEntryRendererProps<TElement, S, M, L>): ReactElement {
  const Element = as ?? 'div'
  const trackingAttributes: ServerTrackingAttributes = getServerTrackingAttributes(
    baselineEntry,
    resolvedData,
    {
      clickable,
      hoverDurationUpdateIntervalMs,
      trackClicks,
      trackHovers,
      trackViews,
      viewDurationUpdateIntervalMs,
    },
  )

  return createElement(
    Element,
    { ...htmlProps, ...trackingAttributes },
    resolvedData.isEmptyVariant === true ? null : children,
  )
}

export function resolveOptimizedEntryChildren(
  children: ServerOptimizedEntryChildren,
  entry: ServerTrackingResolvedData['entry'],
  context: OptimizedEntryRenderContext,
): ReactNode {
  if (context.resolvedData.isEmptyVariant === true) return null

  return typeof children === 'function' ? children(entry, context) : children
}
