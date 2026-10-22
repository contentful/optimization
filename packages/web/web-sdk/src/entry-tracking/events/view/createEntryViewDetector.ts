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
import { createTimedEntryDetector } from '../createTimedEntryDetector'
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
  getResetToken?: () => object | undefined,
): EntryInteractionDetector<
  EntryViewInteractionStartOptions | undefined,
  EntryViewInteractionElementOptions
> {
  let acceptedStickyElements = new WeakSet<Element>()
  let stickyRuntimeToken = getResetToken?.()

  return createTimedEntryDetector<
    EntryViewTrackingCore,
    EntryViewInteractionStartOptions,
    EntryViewInteractionElementOptions,
    ElementViewCallbackInfo,
    ElementViewObserver
  >({
    core,
    getResetToken,
    interaction: 'views',
    createObserver: (callback, options) => new ElementViewObserver(callback, options),
    resolveAttributeOptions: (): undefined => undefined,
    track: async (
      runtimeCore,
      payload,
      info: ElementViewCallbackInfo,
      { element, isCurrent },
    ): Promise<void> => {
      const currentRuntimeToken = getResetToken?.()
      if (stickyRuntimeToken !== currentRuntimeToken) {
        acceptedStickyElements = new WeakSet<Element>()
        stickyRuntimeToken = currentRuntimeToken
      }

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
        isCurrent() &&
        shouldSendSticky &&
        shouldRememberStickyEntryViewResult(shouldSendSticky, result.accepted)
      ) {
        acceptedStickyElements.add(element)
      }
    },
  })
}
