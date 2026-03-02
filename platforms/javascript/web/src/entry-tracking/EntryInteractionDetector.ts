import type { EntryElement } from './resolveComponentTrackingPayload'

/**
 * Detector contract implemented by concrete entry interaction strategies.
 *
 * @typeParam TStartOptions - Options passed when auto-tracking is started.
 * @typeParam TElementOptions - Options passed when manually tracking an element.
 *
 * @public
 */
export interface EntryInteractionDetector<TStartOptions = never, TElementOptions = never> {
  start: (options?: TStartOptions) => void
  stop: () => void
  setAuto?: (enabled: boolean) => void
  onEntryAdded?: (entryElement: EntryElement) => void
  onEntryRemoved?: (entryElement: EntryElement) => void
  onError?: (error: unknown) => void
  enableElement?: (element: Element, options?: TElementOptions) => void
  disableElement?: (element: Element) => void
  clearElement?: (element: Element) => void
}
