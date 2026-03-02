import { createScopedLogger, type CoreStateful } from '@contentful/optimization-core'
import type { EntryInteractionDetector } from '../EntryInteractionDetector'
import type { EntryClickInteractionElementOptions } from '../resolveAutoTrackEntryInteractionOptions'
import { resolveComponentTrackingPayload as resolveTrackedComponentPayload } from '../resolveComponentTrackingPayload'
import { resolveEntryInteractionElementOverride } from '../resolveEntryInteractionElementOverride'

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
  overrideEnabled?: boolean
  attributeOverrideEnabled?: boolean
  overrideData: unknown
}

function isTrackedEntryState(
  state: TrackedEntryState | undefined,
  autoTrackingEnabled: boolean,
): boolean {
  if (!state) return false
  if (state.overrideEnabled === false) return false
  if (state.overrideEnabled === true) return true
  if (state.attributeOverrideEnabled === false) return false
  if (state.attributeOverrideEnabled === true) return true

  return autoTrackingEnabled && state.auto
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
  let autoTrackingEnabled = true

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

      if (!trackedEntryElement && isTrackedEntryState(state, autoTrackingEnabled)) {
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
    const data = state?.overrideEnabled ? state.overrideData : undefined

    return resolveTrackedComponentPayload(data, element)
  }

  const createDefaultTrackedEntryState = (): TrackedEntryState => ({
    auto: false,
    overrideEnabled: undefined,
    overrideData: undefined,
  })

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
    setAuto: (enabled): void => {
      autoTrackingEnabled = enabled
    },
    onEntryAdded: (entryElement): void => {
      const state = trackedEntries.get(entryElement) ?? createDefaultTrackedEntryState()
      state.auto = true
      state.attributeOverrideEnabled = resolveEntryInteractionElementOverride(
        'clicks',
        entryElement,
      )
      trackedEntries.set(entryElement, state)
    },
    onEntryRemoved: (entryElement): void => {
      const state = trackedEntries.get(entryElement)
      if (!state) return

      state.auto = false
      if (state.overrideEnabled !== undefined) return

      trackedEntries.delete(entryElement)
    },
    enableElement: (element, options): void => {
      logger.info('Manually tracking click interaction for element:', element)
      const state = trackedEntries.get(element) ?? createDefaultTrackedEntryState()
      state.overrideEnabled = true
      state.overrideData = options?.data
      trackedEntries.set(element, state)
    },
    disableElement: (element): void => {
      logger.info('Manually disabling click interaction for element:', element)
      const state = trackedEntries.get(element)
      const nextState = state ?? createDefaultTrackedEntryState()
      nextState.overrideEnabled = false
      nextState.overrideData = undefined
      trackedEntries.set(element, nextState)
    },
    clearElement: (element): void => {
      logger.info('Manually clearing click interaction override for element:', element)
      const state = trackedEntries.get(element)
      if (!state) return

      state.overrideEnabled = undefined
      state.overrideData = undefined

      if (state.auto) return

      trackedEntries.delete(element)
    },
  }
}
