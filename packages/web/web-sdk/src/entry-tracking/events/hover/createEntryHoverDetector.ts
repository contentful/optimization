import type { CoreStateful } from '@contentful/optimization-core'
import type { EntryInteractionDetector } from '../../EntryInteractionDetector'
import type { EntryHoverInteractionElementOptions } from '../../resolveAutoTrackEntryInteractionOptions'
import { createTimedEntryDetector } from '../createTimedEntryDetector'
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
): EntryInteractionDetector<undefined, EntryHoverInteractionElementOptions> {
  return createTimedEntryDetector<
    EntryHoverTrackingCore,
    undefined,
    EntryHoverInteractionElementOptions,
    ElementHoverCallbackInfo,
    ElementHoverObserver
  >({
    core,
    interaction: 'hovers',
    createObserver: (callback) => new ElementHoverObserver(callback),
    resolveAttributeOptions: (): undefined => undefined,
    track: async (runtimeCore, payload, info: ElementHoverCallbackInfo): Promise<void> => {
      await runtimeCore.trackHover({
        ...payload,
        hoverId: info.hoverId,
        hoverDurationMs: Math.max(0, Math.round(info.totalHoverMs)),
      })
    },
  })
}
