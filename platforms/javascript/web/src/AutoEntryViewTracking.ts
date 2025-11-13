import {
  type AnalyticsStateful,
  logger,
  type PersonalizationStateful,
} from '@contentful/optimization-core'
import type {
  ElementExistenceObserverOptions,
  ElementViewCallbackInfo,
  ElementViewObserver,
} from './observers'

export type CtflDataset = DOMStringMap & {
  ctflEntryId: string
  ctflDuplicationScope?: string
  ctflPersonalizationId?: string
  ctflSticky?: 'true' | 'false'
  ctflVariantIndex?: string
}

export type EntryElement = (HTMLElement | SVGElement) & { dataset: CtflDataset }

// This does not support legacy browsers that don't support `dataset` on `SVGElement`
export function isEntryElement(element?: Element): element is EntryElement {
  const isWeb = typeof HTMLElement !== 'undefined' && typeof SVGElement !== 'undefined'

  if (!isWeb || !element || element.nodeType !== 1) return false

  if (!('dataset' in element)) return false

  if (!element.dataset || typeof element.dataset !== 'object') return false

  if (!('ctflEntryId' in element.dataset)) return false

  const {
    dataset: { ctflEntryId },
  } = element

  return typeof ctflEntryId === 'string' && ctflEntryId.trim().length > 0
}

export interface EntryData {
  duplicationScope?: string
  entryId: string
  personalizationId?: string
  sticky?: boolean
  variantIndex?: number
}

export function isEntryData(data?: unknown): data is EntryData {
  if (!data) return false
  if (typeof data !== 'object') return false
  return 'entryId' in data && typeof data.entryId === 'string' && !!data.entryId.trim().length
}

function parseSticky(sticky: string | undefined): boolean {
  return (sticky?.trim().toLowerCase() ?? '') === 'true'
}

// Only non-negative integers allowed
function parseVariantIndex(variantIndex: string | undefined): number | undefined {
  if (variantIndex === undefined || !/^\d+$/.test(variantIndex)) return undefined
  const n = Number(variantIndex)
  return Number.isSafeInteger(n) ? n : undefined
}

export const createAutoTrackingEntryViewCallback =
  ({
    personalization,
    analytics,
  }: {
    personalization: PersonalizationStateful
    analytics: AnalyticsStateful
  }) =>
  async (element: Element, info: ElementViewCallbackInfo): Promise<void> => {
    if (!isEntryData(info.data) && !isEntryElement(element)) return

    let duplicationScope: string | undefined = undefined
    let entryId: string | undefined = undefined
    let personalizationId: string | undefined = undefined
    let sticky: boolean | undefined = undefined
    let variantIndex: number | undefined = undefined

    if (isEntryData(info.data)) {
      ;({
        data: { duplicationScope, entryId, personalizationId, sticky, variantIndex },
      } = info)
    } else if (isEntryElement(element)) {
      ;({
        dataset: {
          ctflDuplicationScope: duplicationScope,
          ctflEntryId: entryId,
          ctflPersonalizationId: personalizationId,
        },
      } = element)

      const {
        dataset: { ctflSticky, ctflVariantIndex },
      } = element

      sticky = parseSticky(ctflSticky)
      variantIndex = parseVariantIndex(ctflVariantIndex)
    }

    if (!entryId) {
      logger.warn(
        '[Element View Observer Callback] No entry data found; please add data attributes or observe with data info',
      )
      return
    }

    if (sticky)
      await personalization.trackComponentView(
        {
          componentId: entryId,
          experienceId: personalizationId,
          variantIndex,
        },
        duplicationScope,
      )

    await analytics.trackComponentView(
      {
        componentId: entryId,
        experienceId: personalizationId,
        variantIndex,
      },
      duplicationScope,
    )
  }

function findEntryElement(element: Element): EntryElement | undefined {
  if (isEntryElement(element)) return element

  const maybeEntryElement = element.querySelector('[data-ctfl-entry-id]') ?? undefined

  return isEntryElement(maybeEntryElement) ? maybeEntryElement : undefined
}

export const createAutoTrackingEntryExistenceCallback = (
  entryViewObserver: ElementViewObserver,
): ElementExistenceObserverOptions => ({
  onRemoved: (elements: readonly Element[]): void => {
    elements.forEach((element) => {
      const ctflElement = findEntryElement(element)

      if (!ctflElement || !entryViewObserver.getStats(ctflElement)) return

      logger.info('[Optimization Web SDK] Auto-removing element:', ctflElement)
      entryViewObserver.unobserve(ctflElement)
    })
  },
  onAdded: (elements: readonly Element[]): void => {
    elements.forEach((element) => {
      const ctflElement = findEntryElement(element)

      if (!ctflElement) return

      logger.info('[Optimization Web SDK] Auto-observing element:', ctflElement)
      entryViewObserver.observe(ctflElement)
    })
  },
})
