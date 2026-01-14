import { type CoreStateful, createScopedLogger } from '@contentful/optimization-core'
import type {
  ElementExistenceObserverOptions,
  ElementViewCallbackInfo,
  ElementViewObserver,
} from './observers'

const logger = createScopedLogger('Web:AutoTracking')

/**
 * Data attributes used by the Web SDK to identify and configure tracked entries.
 */
export type CtflDataset = DOMStringMap & {
  /** Entry ID associated with the element. */
  ctflEntryId: string
  /** Optional duplication scope key for de-duplication across views. */
  ctflDuplicationScope?: string
  /** Optional baseline ID associated with the personalized entry. */
  ctflBaselineId?: string
  /** Optional personalization/experience ID associated with the entry. */
  ctflPersonalizationId?: string
  /** Whether this component view should be treated as sticky. */
  ctflSticky?: 'true' | 'false'
  /** Optional variant index for personalized variants (non-negative integer). */
  ctflVariantIndex?: string
}

/**
 * Element type representing a Contentful entry with required dataset attributes.
 *
 * @remarks
 * This does not support legacy browsers that do not expose `dataset` on `SVGElement`.
 */
export type EntryElement = (HTMLElement | SVGElement) & { dataset: CtflDataset }

/**
 * Type guard that determines whether a given element is a tracked entry element.
 *
 * @param element - Candidate element.
 * @returns `true` if the element exposes a valid `ctflEntryId` dataset property.
 */
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

/**
 * Normalized entry data resolved either from `dataset` or explicit callback data.
 */
export interface EntryData {
  /** Optional duplication scope used for de-duplication. */
  duplicationScope?: string
  /** ID of the Contentful entry. */
  entryId: string
  /** Optional personalization/experience ID. */
  personalizationId?: string
  /** Whether the view is sticky. */
  sticky?: boolean
  /** Optional variant index (non-negative integer). */
  variantIndex?: number
}

/**
 * Type guard that determines whether an arbitrary value is {@link EntryData}.
 *
 * @param data - Unknown value to validate.
 * @returns `true` if the object contains a non-empty entryId string.
 */
export function isEntryData(data?: unknown): data is EntryData {
  if (!data) return false
  if (typeof data !== 'object') return false
  return 'entryId' in data && typeof data.entryId === 'string' && !!data.entryId.trim().length
}

/**
 * Parse a string flag into a boolean indicating sticky behavior.
 *
 * @param sticky - Raw sticky string from dataset.
 * @returns `true` when the value equals `"true"` (case-insensitive); otherwise `false`.
 */
function parseSticky(sticky: string | undefined): boolean {
  return (sticky?.trim().toLowerCase() ?? '') === 'true'
}

/**
 * Parse a non-negative integer variant index.
 *
 * @param variantIndex - Raw variantIndex string from dataset.
 * @returns Parsed number when valid and safe, otherwise `undefined`.
 */
function parseVariantIndex(variantIndex: string | undefined): number | undefined {
  if (variantIndex === undefined || !/^\d+$/.test(variantIndex)) return undefined
  const n = Number(variantIndex)
  return Number.isSafeInteger(n) ? n : undefined
}

/**
 * Create a callback that wires ElementViewObserver events into `trackComponentView`
 * on the {@link CoreStateful} instance.
 *
 * @param core - Stateful core instance used to send component view events.
 * @returns A callback suitable for use with {@link ElementViewObserver}.
 *
 * @example
 * ```ts
 * const callback = createAutoTrackingEntryViewCallback(core)
 * const observer = new ElementViewObserver(callback, { dwellTimeMs: 1000 })
 * observer.observe(element, { data: { entryId: 'xyz' } })
 * ```
 */
export const createAutoTrackingEntryViewCallback =
  (core: CoreStateful) =>
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
        'No entry data found in entry view observer callback; please add data attributes or observe with data info',
      )
      return
    }

    await core.trackComponentView(
      {
        componentId: entryId,
        experienceId: personalizationId,
        sticky,
        variantIndex,
      },
      duplicationScope,
    )
  }

/**
 * Find a descendant or self element that qualifies as an {@link EntryElement}.
 *
 * @param element - Starting element.
 * @returns The matching entry element, if any.
 */
function findEntryElement(element: Element): EntryElement | undefined {
  if (isEntryElement(element)) return element

  const maybeEntryElement = element.querySelector('[data-ctfl-entry-id]') ?? undefined

  return isEntryElement(maybeEntryElement) ? maybeEntryElement : undefined
}

/**
 * Create an {@link ElementExistenceObserverOptions} object that auto-observes
 * and/or unobserves entry elements for a given {@link ElementViewObserver}.
 *
 * @param entryViewObserver - ElementViewObserver instance to manage.
 * @param autoObserveEntryElements - When `true`, automatically start observing
 *   newly-added entry elements.
 * @returns Options object suitable for constructing an ElementExistenceObserver.
 *
 * @example
 * ```ts
 * const viewObserver = new ElementViewObserver(callback, { dwellTimeMs: 1000 })
 * const existenceOpts = createAutoTrackingEntryExistenceCallback(viewObserver, true)
 * const existenceObserver = new ElementExistenceObserver(existenceOpts)
 * ```
 */
export const createAutoTrackingEntryExistenceCallback = (
  entryViewObserver: ElementViewObserver,
  autoObserveEntryElements = false,
): ElementExistenceObserverOptions => ({
  onRemoved: (elements: readonly Element[]): void => {
    elements.forEach((element) => {
      const ctflElement = findEntryElement(element)

      if (!ctflElement || !entryViewObserver.getStats(ctflElement)) return

      logger.info('Auto-unobserving element (remove):', ctflElement)
      entryViewObserver.unobserve(ctflElement)
    })
  },
  onAdded: autoObserveEntryElements
    ? (elements: readonly Element[]): void => {
        elements.forEach((element) => {
          const ctflElement = findEntryElement(element)

          if (!ctflElement) return

          logger.info('Auto-observing element (add):', ctflElement)
          entryViewObserver.observe(ctflElement)
        })
      }
    : undefined,
})
