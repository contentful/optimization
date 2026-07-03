import { createElement, type JSX, type ReactElement, type ReactNode } from 'react'
import {
  getServerTrackingAttributes,
  type ServerTrackingAttributeOptions,
  type ServerTrackingAttributes,
  type ServerTrackingBaselineEntry,
  type ServerTrackingResolvedData,
} from './tracking-attributes'

type ServerEntryRendererOwnProps<TElement extends keyof JSX.IntrinsicElements> =
  ServerTrackingAttributeOptions & {
    readonly as?: TElement
    readonly baselineEntry: ServerTrackingBaselineEntry
    readonly children?: ReactNode
    readonly resolvedData: ServerTrackingResolvedData
  }

type DataCtflAttributeName = `data-ctfl-${string}`

type ServerEntryRendererProps<TElement extends keyof JSX.IntrinsicElements = 'div'> =
  ServerEntryRendererOwnProps<TElement> &
    Omit<
      JSX.IntrinsicElements[TElement],
      keyof ServerEntryRendererOwnProps<TElement> | DataCtflAttributeName
    >

export function renderOptimizedEntryOnServer<TElement extends keyof JSX.IntrinsicElements = 'div'>({
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
}: ServerEntryRendererProps<TElement>): ReactElement {
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

  return createElement(Element, { ...htmlProps, ...trackingAttributes }, children)
}
