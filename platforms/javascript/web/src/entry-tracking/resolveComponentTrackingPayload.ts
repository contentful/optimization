/**
 * Data attributes used by the Web SDK to identify and configure tracked entries.
 *
 * @public
 */
export type CtflDataset = DOMStringMap & {
  /** Entry ID associated with the element. */
  ctflEntryId: string
  /** Optional baseline ID associated with the personalized entry. */
  ctflBaselineId?: string
  /** Optional personalization/experience ID associated with the entry. */
  ctflPersonalizationId?: string
  /** Whether this component interaction should be treated as sticky. */
  ctflSticky?: 'true' | 'false'
  /** Optional variant index for personalized variants (non-negative integer). */
  ctflVariantIndex?: string
  /** Optional per-element override for automatic click tracking (`'true'`/`'false'`). */
  ctflTrackClicks?: 'true' | 'false'
  /** Optional per-element override for automatic view tracking (`'true'`/`'false'`). */
  ctflTrackViews?: 'true' | 'false'
  /** Optional per-element override for automatic hover tracking (`'true'`/`'false'`). */
  ctflTrackHovers?: 'true' | 'false'
  /** Optional per-element view-duration update interval override in milliseconds. */
  ctflViewDurationUpdateIntervalMs?: string
  /** Optional per-element hover-duration update interval override in milliseconds. */
  ctflHoverDurationUpdateIntervalMs?: string
}

/**
 * Element type representing a Contentful entry with required dataset attributes.
 *
 * @remarks
 * This does not support legacy browsers that do not expose `dataset` on `SVGElement`.
 *
 * @public
 */
export type EntryElement = (HTMLElement | SVGElement) & { dataset: CtflDataset }

/**
 * Normalized entry data resolved either from `dataset` or explicit callback data.
 *
 * @public
 */
export interface EntryData {
  /** ID of the Contentful entry. */
  entryId: string
  /** Optional personalization/experience ID. */
  personalizationId?: string
  /** Whether the view is sticky. */
  sticky?: boolean
  /** Optional variant index (non-negative integer). */
  variantIndex?: number
}

const asNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  return value.trim() ? value : undefined
}

const isHtmlOrSvgElement = (value: unknown): value is HTMLElement | SVGElement => {
  if (typeof HTMLElement === 'undefined' || typeof SVGElement === 'undefined') return false
  return value instanceof HTMLElement || value instanceof SVGElement
}

/**
 * Type guard that determines whether a given element is a tracked entry element.
 *
 * @param element - Candidate element.
 * @returns `true` if the element exposes a valid `ctflEntryId` dataset property.
 *
 * @public
 */
export function isEntryElement(element?: Element): element is EntryElement {
  if (!isHtmlOrSvgElement(element)) return false

  return !!asNonEmptyString(element.dataset.ctflEntryId)
}

/**
 * Type guard that determines whether an arbitrary value is {@link EntryData}.
 *
 * @param data - Unknown value to validate.
 * @returns `true` if the object contains a non-empty entryId string.
 *
 * @public
 */
export function isEntryData(data?: unknown): data is EntryData {
  if (!data || typeof data !== 'object') return false
  return !!asNonEmptyString((data as Partial<EntryData>).entryId)
}

const parseSticky = (sticky: string | undefined): boolean =>
  (sticky?.trim().toLowerCase() ?? '') === 'true'

const parseVariantIndex = (variantIndex: string | undefined): number | undefined => {
  if (!variantIndex || !/^\d+$/.test(variantIndex)) return undefined

  const n = Number(variantIndex)
  return Number.isSafeInteger(n) ? n : undefined
}

const resolveEntryDataFromElement = (element: Element): EntryData | undefined => {
  if (!isEntryElement(element)) return undefined

  const {
    dataset: {
      ctflEntryId: entryId,
      ctflPersonalizationId: personalizationId,
      ctflSticky,
      ctflVariantIndex,
    },
  } = element

  return {
    entryId,
    personalizationId,
    sticky: parseSticky(ctflSticky),
    variantIndex: parseVariantIndex(ctflVariantIndex),
  }
}

const resolveEntryData = (data: unknown, element: Element): EntryData | undefined => {
  if (isEntryData(data)) return data
  return resolveEntryDataFromElement(element)
}

/**
 * Resolve the component-tracking payload used by tracked entry interactions.
 *
 * @param data - Optional explicit entry data supplied by manual tracking calls.
 * @param element - Candidate DOM element for deriving entry data when explicit
 * data is absent.
 * @returns A normalized tracking payload or `undefined` when no valid entry
 * data can be resolved.
 *
 * @public
 */
export function resolveComponentTrackingPayload(
  data: unknown,
  element: Element,
):
  | {
      componentId: string
      experienceId?: string
      sticky?: boolean
      variantIndex?: number
    }
  | undefined {
  const entryData = resolveEntryData(data, element)

  if (!entryData) return undefined

  return {
    componentId: entryData.entryId,
    experienceId: entryData.personalizationId,
    sticky: entryData.sticky,
    variantIndex: entryData.variantIndex,
  }
}
