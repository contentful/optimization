import { createScopedLogger, type CoreStateful } from '@contentful/optimization-core'
import type { EntryInteractionDetector } from '../EntryInteractionTrackerHost'
import type { EntryClickInteractionElementOptions } from '../resolveAutoTrackEntryInteractionOptions'
import { resolveComponentTrackingPayload as resolveTrackedComponentPayload } from '../resolveComponentTrackingPayload'

const logger = createScopedLogger('Web:EntryClickTracking')

/**
 * Minimal core shape required for entry click tracking.
 *
 * @public
 */
export type EntryClickTrackingCore = Pick<CoreStateful, 'trackComponentClick'>

const CLICKABLE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[onclick]',
  '[data-ctfl-clickable="true"]',
].join(',')

/**
 * Internal bookkeeping state for a tracked entry element.
 *
 * @internal
 */
interface TrackedEntryState {
  auto: boolean
  manual: boolean
  manualData: unknown
}

function isTrackedEntryState(state: TrackedEntryState | undefined): boolean {
  return Boolean(state && (state.auto || state.manual))
}

function hasOnclickPropertyHandler(element: Element): boolean {
  return element instanceof HTMLElement && typeof element.onclick === 'function'
}

function toEventTargetElement(event: Event): Element | undefined {
  if (event.target instanceof Element) return event.target

  const { target: targetNode } = event

  return targetNode instanceof Node ? (targetNode.parentElement ?? undefined) : undefined
}

/**
 * Per-element options for click interaction tracking.
 *
 * @public
 */
type EntryClickElementOptions = EntryClickInteractionElementOptions

/**
 * Create the click detector plugin used by the generic interaction tracker host.
 *
 * @internal
 */
export function createEntryClickDetector(
  core: EntryClickTrackingCore,
): EntryInteractionDetector<undefined, EntryClickElementOptions> {
  const trackedEntries = new Map<Element, TrackedEntryState>()
  let listening = false

  /**
   * Resolve tracked-entry ownership and clickability from an event target.
   *
   * @internal
   */
  const resolveClickContext = (
    eventTarget: Element,
  ): { trackedEntryElement?: Element; hasClickablePath: boolean } => {
    // Native selector traversal is a fast path for HTML semantics and data-attribute hints.
    const hasClickableSelectorPath = eventTarget.closest(CLICKABLE_SELECTOR) !== null
    let current: Element | null = eventTarget
    let trackedEntryElement: Element | undefined = undefined
    let hasOnclickPropertyPath = false

    while (current) {
      const state = trackedEntries.get(current)

      if (!trackedEntryElement && isTrackedEntryState(state)) {
        trackedEntryElement = current
      }

      if (!hasClickableSelectorPath && !hasOnclickPropertyPath) {
        hasOnclickPropertyPath = hasOnclickPropertyHandler(current)
      }

      const hasClickablePath = hasClickableSelectorPath || hasOnclickPropertyPath

      if (trackedEntryElement && hasClickablePath) {
        break
      }

      const { parentElement }: { parentElement: Element | null } = current
      current = parentElement
    }

    const hasClickablePath = hasClickableSelectorPath || hasOnclickPropertyPath

    return {
      trackedEntryElement,
      hasClickablePath,
    }
  }

  const resolveTrackingPayload = (
    element: Element,
  ): ReturnType<typeof resolveTrackedComponentPayload> => {
    const state = trackedEntries.get(element)
    const data = state?.manual ? state.manualData : undefined

    return resolveTrackedComponentPayload(data, element)
  }

  const onDocumentClick = (event: MouseEvent): void => {
    const eventTarget = toEventTargetElement(event)

    if (!eventTarget) return

    const { hasClickablePath, trackedEntryElement } = resolveClickContext(eventTarget)
    if (!trackedEntryElement || !hasClickablePath) return

    const payload = resolveTrackingPayload(trackedEntryElement)

    if (!payload) {
      logger.warn(
        'No entry data found in entry click callback; please add data attributes or track with data info',
      )
      return
    }

    void core.trackComponentClick(payload)
  }

  return {
    start: (): void => {
      if (typeof document === 'undefined') return

      document.addEventListener('click', onDocumentClick, true)
      listening = true
    },
    stop: (): void => {
      if (listening && typeof document !== 'undefined') {
        document.removeEventListener('click', onDocumentClick, true)
      }

      listening = false
      trackedEntries.clear()
    },
    onEntryAdded: (entryElement): void => {
      const state = trackedEntries.get(entryElement)

      if (!state) {
        trackedEntries.set(entryElement, {
          auto: true,
          manual: false,
          manualData: undefined,
        })
        return
      }

      state.auto = true
    },
    onEntryRemoved: (entryElement): void => {
      trackedEntries.delete(entryElement)
    },
    trackElement: (element, options): void => {
      logger.info('Manually tracking click interaction for element:', element)
      const { data } = options
      const state = trackedEntries.get(element) ?? {
        auto: false,
        manual: false,
        manualData: undefined,
      }
      state.manual = true
      state.manualData = data
      trackedEntries.set(element, state)
    },
    untrackElement: (element): void => {
      logger.info('Manually untracking click interaction for element:', element)
      const state = trackedEntries.get(element)

      if (!state) return

      state.manual = false
      state.manualData = undefined

      if (state.auto) return

      trackedEntries.delete(element)
    },
  }
}
