import {
  shouldRememberStickyEntryViewResult,
  shouldSendStickyEntryView,
  type CoreStateful,
} from '@contentful/optimization-core'
import type { EntryInteractionDetector } from '../../EntryInteractionDetector'
import type {
  EntryViewInteractionElementOptions,
  EntryViewInteractionStartOptions,
} from '../../resolveAutoTrackEntryInteractionOptions'
import {
  createTimedEntryDetector,
  isHtmlOrSvgElement,
  parseNonNegativeNumber,
} from '../createTimedEntryDetector'
import type { ElementViewCallbackInfo } from './element-view-observer-support'
import ElementViewObserver from './ElementViewObserver'

export {
  isEntryData,
  isEntryElement,
  type CtflDataset,
  type EntryData,
  type EntryElement,
} from '../../resolveTrackingPayload'

export type EntryViewTrackingCore = Pick<CoreStateful, 'trackView'>

export function createEntryViewDetector(
  core: EntryViewTrackingCore,
): EntryInteractionDetector<
  EntryViewInteractionStartOptions | undefined,
  EntryViewInteractionElementOptions
> {
  const acceptedStickyElements = new WeakSet<Element>()

  return createTimedEntryDetector<
    EntryViewTrackingCore,
    EntryViewInteractionStartOptions,
    EntryViewInteractionElementOptions,
    ElementViewCallbackInfo,
    ElementViewObserver
  >({
    core,
    interaction: 'views',
    createObserver: (callback, options) => new ElementViewObserver(callback, options),
    resolveAttributeOptions: (element): EntryViewInteractionElementOptions | undefined => {
      if (!isHtmlOrSvgElement(element)) return undefined

      const viewDurationUpdateIntervalMs = parseNonNegativeNumber(
        element.dataset.ctflViewDurationUpdateIntervalMs,
      )

      if (viewDurationUpdateIntervalMs === undefined) return undefined

      return {
        viewDurationUpdateIntervalMs,
      }
    },
    track: async (runtimeCore, payload, info: ElementViewCallbackInfo, element): Promise<void> => {
      const shouldSendSticky = shouldSendStickyEntryView(
        payload.sticky,
        acceptedStickyElements.has(element),
      )

      const result = await runtimeCore.trackView({
        ...payload,
        sticky: shouldSendSticky ? true : undefined,
        viewId: info.viewId,
        viewDurationMs: Math.max(0, Math.round(info.totalVisibleMs)),
      })

      if (
        shouldSendSticky &&
        shouldRememberStickyEntryViewResult(shouldSendSticky, result.accepted)
      ) {
        acceptedStickyElements.add(element)
      }
    },
  })
}
