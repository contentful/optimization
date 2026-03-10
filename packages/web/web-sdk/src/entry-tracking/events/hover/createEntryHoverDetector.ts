import type { CoreStateful } from '@contentful/optimization-core'
import type { EntryInteractionDetector } from '../../EntryInteractionDetector'
import type {
  EntryHoverInteractionElementOptions,
  EntryHoverInteractionStartOptions,
} from '../../resolveAutoTrackEntryInteractionOptions'
import {
  createTimedEntryDetector,
  isHtmlOrSvgElement,
  parseNonNegativeNumber,
} from '../createTimedEntryDetector'
import type { ElementHoverCallbackInfo } from './element-hover-observer-support'
import ElementHoverObserver from './ElementHoverObserver'

export {
  isEntryData,
  isEntryElement,
  type CtflDataset,
  type EntryData,
  type EntryElement,
} from '../../resolveTrackingPayload'

export type EntryHoverTrackingCore = Pick<CoreStateful, 'trackHover'>

export function createEntryHoverDetector(
  core: EntryHoverTrackingCore,
): EntryInteractionDetector<
  EntryHoverInteractionStartOptions | undefined,
  EntryHoverInteractionElementOptions
> {
  return createTimedEntryDetector<
    EntryHoverTrackingCore,
    EntryHoverInteractionStartOptions,
    EntryHoverInteractionElementOptions,
    ElementHoverCallbackInfo,
    ElementHoverObserver
  >({
    core,
    interaction: 'hovers',
    createObserver: (callback, options) => new ElementHoverObserver(callback, options),
    resolveAttributeOptions: (element): EntryHoverInteractionElementOptions | undefined => {
      if (!isHtmlOrSvgElement(element)) return undefined

      const hoverDurationUpdateIntervalMs = parseNonNegativeNumber(
        element.dataset.ctflHoverDurationUpdateIntervalMs,
      )

      if (hoverDurationUpdateIntervalMs === undefined) return undefined

      return {
        hoverDurationUpdateIntervalMs,
      }
    },
    track: async (runtimeCore, payload, info: ElementHoverCallbackInfo): Promise<void> => {
      await runtimeCore.trackHover({
        ...payload,
        hoverId: info.hoverId,
        hoverDurationMs: Math.max(0, Math.round(info.totalHoverMs)),
      })
    },
  })
}
