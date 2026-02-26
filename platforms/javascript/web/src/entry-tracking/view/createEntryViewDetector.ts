import { type CoreStateful, createScopedLogger } from '@contentful/optimization-core'
import type { EntryInteractionDetector } from '../EntryInteractionTrackerHost'
import type {
  EntryViewInteractionElementOptions,
  EntryViewInteractionStartOptions,
} from '../resolveAutoTrackEntryInteractionOptions'
import { resolveComponentTrackingPayload as resolveTrackedComponentPayload } from '../resolveComponentTrackingPayload'
import type { ElementViewCallbackInfo } from './element-view-observer-support'
import ElementViewObserver from './ElementViewObserver'

export {
  isEntryData,
  isEntryElement,
  type CtflDataset,
  type EntryData,
  type EntryElement,
} from '../resolveComponentTrackingPayload'

/**
 * Scoped logger used by entry-view interaction tracking.
 *
 * @internal
 */
const logger = createScopedLogger('Web:EntryViewTracking')

/**
 * Minimal core shape required for entry view tracking.
 *
 * @public
 */
export type EntryViewTrackingCore = Pick<CoreStateful, 'trackComponentView'>

/**
 * Create a callback that wires ElementViewObserver events into `trackComponentView`
 * on the {@link CoreStateful} instance.
 *
 * @param core - Stateful core instance used to send component view events.
 * @returns A callback suitable for use with {@link ElementViewObserver}.
 *
 * @public
 */
const createAutoTrackingEntryViewCallback =
  (core: EntryViewTrackingCore) =>
  async (element: Element, info: ElementViewCallbackInfo): Promise<void> => {
    const payload = resolveTrackedComponentPayload(info.data, element)

    if (!payload) return

    await core.trackComponentView(payload)
  }

/**
 * Create the view detector plugin used by the generic interaction tracker host.
 *
 * @internal
 */
export function createEntryViewDetector(
  core: EntryViewTrackingCore,
): EntryInteractionDetector<
  EntryViewInteractionStartOptions | undefined,
  EntryViewInteractionElementOptions
> {
  let elementViewObserver: ElementViewObserver | undefined = undefined

  return {
    start: (options): void => {
      elementViewObserver = new ElementViewObserver(
        createAutoTrackingEntryViewCallback(core),
        options,
      )
    },
    stop: (): void => {
      elementViewObserver?.disconnect()
      elementViewObserver = undefined
    },
    onEntryAdded: (element): void => {
      logger.info('Auto-observing element:', element)
      elementViewObserver?.observe(element)
    },
    onEntryRemoved: (element): void => {
      logger.info('Auto-unobserving element (remove):', element)
      elementViewObserver?.unobserve(element)
    },
    trackElement: (element, options): void => {
      logger.info('Manually observing element:', element)
      elementViewObserver?.observe(element, options)
    },
    untrackElement: (element): void => {
      logger.info('Manually unobserving element:', element)
      elementViewObserver?.unobserve(element)
    },
  }
}
