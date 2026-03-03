import type { EntryInteractionDetector } from '../EntryInteractionDetector'
import type { EntryInteraction } from '../resolveAutoTrackEntryInteractionOptions'
import { resolveComponentTrackingPayload } from '../resolveComponentTrackingPayload'
import { resolveEntryInteractionElementOverride } from '../resolveEntryInteractionElementOverride'

interface TimedObserver<TElementOptions> {
  observe: (element: Element, options?: TElementOptions) => void
  unobserve: (element: Element) => void
  disconnect: () => void
}

interface ElementOverride<TOptions> {
  enabled: boolean
  options?: TOptions
}

interface AttributeOverride<TOptions> {
  enabled?: boolean
  options?: TOptions
}

interface CreateTimedEntryDetectorOptions<
  TCore,
  TStartOptions,
  TElementOptions,
  TInfo extends { data?: unknown },
  TObserver extends TimedObserver<TElementOptions>,
> {
  core: TCore
  interaction: EntryInteraction
  createObserver: (
    callback: (element: Element, info: TInfo) => Promise<void>,
    options: TStartOptions | undefined,
  ) => TObserver
  resolveAttributeOptions: (element: Element) => TElementOptions | undefined
  track: (
    core: TCore,
    payload: NonNullable<ReturnType<typeof resolveComponentTrackingPayload>>,
    info: TInfo,
  ) => Promise<void>
}

export const isHtmlOrSvgElement = (element: Element): element is HTMLElement | SVGElement => {
  if (typeof HTMLElement === 'undefined' || typeof SVGElement === 'undefined') return false

  return element instanceof HTMLElement || element instanceof SVGElement
}

export const parseNonNegativeNumber = (raw: string | undefined): number | undefined => {
  if (typeof raw !== 'string') return undefined
  const normalized = raw.trim()
  if (!normalized) return undefined

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined

  return parsed
}

export function createTimedEntryDetector<
  TCore,
  TStartOptions,
  TElementOptions,
  TInfo extends { data?: unknown },
  TObserver extends TimedObserver<TElementOptions>,
>({
  core,
  interaction,
  createObserver,
  resolveAttributeOptions,
  track,
}: CreateTimedEntryDetectorOptions<
  TCore,
  TStartOptions,
  TElementOptions,
  TInfo,
  TObserver
>): EntryInteractionDetector<TStartOptions | undefined, TElementOptions> {
  const createCallback =
    (runtimeCore: TCore) =>
    async (element: Element, info: TInfo): Promise<void> => {
      const payload = resolveComponentTrackingPayload(info.data, element)
      if (!payload) return

      await track(runtimeCore, payload, info)
    }

  let observer: TObserver | undefined = undefined
  let autoTrackingEnabled = true

  const autoTrackedElements = new Set<Element>()
  const attributeOverrides = new Map<Element, AttributeOverride<TElementOptions>>()
  const elementOverrides = new Map<Element, ElementOverride<TElementOptions>>()

  const resolveOverride = (element: Element): ElementOverride<TElementOptions> | undefined =>
    elementOverrides.get(element)

  const resolveAttributeOverride = (
    element: Element,
  ): AttributeOverride<TElementOptions> | undefined => attributeOverrides.get(element)

  const resolveElementAttributeOverride = (
    element: Element,
  ): AttributeOverride<TElementOptions> | undefined => {
    const enabled = resolveEntryInteractionElementOverride(interaction, element)
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
    if (!observer) return

    if (!shouldObserveElement(element)) {
      observer.unobserve(element)
      return
    }

    const override = resolveOverride(element)
    const attributeOverride = resolveAttributeOverride(element)
    const options = override?.enabled ? override.options : attributeOverride?.options
    observer.observe(element, options)
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
      observer = createObserver(createCallback(core), options)
      reconcileAllElements()
    },
    stop: (): void => {
      observer?.disconnect()
      observer = undefined
      autoTrackedElements.clear()
      attributeOverrides.clear()
      elementOverrides.clear()
    },
    setAuto: (enabled): void => {
      autoTrackingEnabled = enabled
      reconcileAllElements()
    },
    onEntryAdded: (element): void => {
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
      autoTrackedElements.delete(element)
      attributeOverrides.delete(element)
      applyElementObservation(element)
    },
    enableElement: (element, options): void => {
      const previous = resolveOverride(element)
      if (previous?.enabled && previous.options === options) return

      elementOverrides.set(element, { enabled: true, options })
      if (previous?.enabled) {
        observer?.unobserve(element)
      }

      applyElementObservation(element)
    },
    disableElement: (element): void => {
      elementOverrides.set(element, { enabled: false })
      applyElementObservation(element)
    },
    clearElement: (element): void => {
      if (!elementOverrides.delete(element)) return

      applyElementObservation(element)
    },
  }
}
