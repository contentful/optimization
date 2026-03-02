import { createScopedLogger, type CoreStateful } from '@contentful/optimization-core'
import type { EntryInteractionDetector } from '../EntryInteractionDetector'
import type {
  EntryViewInteractionElementOptions,
  EntryViewInteractionStartOptions,
} from '../resolveAutoTrackEntryInteractionOptions'
import { resolveComponentTrackingPayload as resolveTrackedComponentPayload } from '../resolveComponentTrackingPayload'
import { resolveEntryInteractionElementOverride } from '../resolveEntryInteractionElementOverride'
import type { ElementViewCallbackInfo } from './element-view-observer-support'
import ElementViewObserver from './ElementViewObserver'

export {
  isEntryData,
  isEntryElement,
  type CtflDataset,
  type EntryData,
  type EntryElement,
} from '../resolveComponentTrackingPayload'

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

    await core.trackComponentView({
      ...payload,
      componentViewId: info.componentViewId,
      viewDurationMs: Math.max(0, Math.round(info.totalVisibleMs)),
    })
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
  interface EntryViewElementOverride {
    enabled: boolean
    options?: EntryViewInteractionElementOptions
  }
  interface EntryViewAttributeOverride {
    enabled?: boolean
    options?: EntryViewInteractionElementOptions
  }

  let elementViewObserver: ElementViewObserver | undefined = undefined
  let autoTrackingEnabled = true

  const autoTrackedElements = new Set<Element>()
  const attributeOverrides = new Map<Element, EntryViewAttributeOverride>()
  const elementOverrides = new Map<Element, EntryViewElementOverride>()

  const resolveOverride = (element: Element): EntryViewElementOverride | undefined =>
    elementOverrides.get(element)
  const resolveAttributeOverride = (element: Element): EntryViewAttributeOverride | undefined =>
    attributeOverrides.get(element)

  const parseNonNegativeNumber = (raw: string | undefined): number | undefined => {
    if (typeof raw !== 'string') return undefined
    const normalized = raw.trim()
    if (!normalized) return undefined

    const parsed = Number(normalized)
    if (!Number.isFinite(parsed) || parsed < 0) return undefined

    return parsed
  }

  const resolveAttributeOptions = (
    element: Element,
  ): EntryViewInteractionElementOptions | undefined => {
    if (typeof HTMLElement === 'undefined' || typeof SVGElement === 'undefined') return undefined
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) return undefined

    const viewDurationUpdateIntervalMs = parseNonNegativeNumber(
      element.dataset.ctflViewDurationUpdateIntervalMs,
    )

    if (viewDurationUpdateIntervalMs === undefined) return undefined

    return {
      viewDurationUpdateIntervalMs,
    }
  }

  const resolveElementAttributeOverride = (
    element: Element,
  ): EntryViewAttributeOverride | undefined => {
    const enabled = resolveEntryInteractionElementOverride('views', element)
    const options = resolveAttributeOptions(element)

    if (enabled === undefined && options === undefined) return undefined

    return { enabled, options }
  }

  const shouldObserveElement = (element: Element): boolean => {
    const override = resolveOverride(element)
    if (override && !override.enabled) return false
    if (override?.enabled) return true

    const attributeOverride = resolveAttributeOverride(element)
    if (attributeOverride?.enabled === false) return false
    if (attributeOverride?.enabled === true) return true

    return autoTrackingEnabled && autoTrackedElements.has(element)
  }

  const applyElementObservation = (element: Element): void => {
    if (!elementViewObserver) return

    if (!shouldObserveElement(element)) {
      elementViewObserver.unobserve(element)
      return
    }

    const override = resolveOverride(element)
    const attributeOverride = resolveAttributeOverride(element)
    const options = override?.enabled ? override.options : attributeOverride?.options
    elementViewObserver.observe(element, options)
  }

  const reconcileAllElements = (): void => {
    const candidates = new Set<Element>(autoTrackedElements)
    attributeOverrides.forEach((_, element) => {
      candidates.add(element)
    })
    elementOverrides.forEach((_, element) => {
      candidates.add(element)
    })

    candidates.forEach((element) => {
      applyElementObservation(element)
    })
  }

  return {
    start: (options): void => {
      elementViewObserver = new ElementViewObserver(
        createAutoTrackingEntryViewCallback(core),
        options,
      )
      reconcileAllElements()
    },
    stop: (): void => {
      elementViewObserver?.disconnect()
      elementViewObserver = undefined
      autoTrackedElements.clear()
      attributeOverrides.clear()
      elementOverrides.clear()
    },
    setAuto: (enabled): void => {
      autoTrackingEnabled = enabled
      reconcileAllElements()
    },
    onEntryAdded: (element): void => {
      logger.info('Auto-observing element:', element)
      autoTrackedElements.add(element)
      const attributeOverride = resolveElementAttributeOverride(element)
      if (attributeOverride === undefined) {
        attributeOverrides.delete(element)
      } else {
        attributeOverrides.set(element, attributeOverride)
      }
      applyElementObservation(element)
    },
    onEntryRemoved: (element): void => {
      logger.info('Auto-unobserving element (remove):', element)
      autoTrackedElements.delete(element)
      attributeOverrides.delete(element)
      applyElementObservation(element)
    },
    enableElement: (element, options): void => {
      logger.info('Manually observing element:', element)
      const previous = resolveOverride(element)
      if (previous?.enabled && previous.options === options) return

      elementOverrides.set(element, { enabled: true, options })
      if (previous?.enabled) {
        elementViewObserver?.unobserve(element)
      }
      applyElementObservation(element)
    },
    disableElement: (element): void => {
      logger.info('Manually disabling element observation:', element)
      elementOverrides.set(element, { enabled: false })
      applyElementObservation(element)
    },
    clearElement: (element): void => {
      logger.info('Manually clearing element observation override:', element)
      if (!elementOverrides.delete(element)) return
      applyElementObservation(element)
    },
  }
}
