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

/**
 * Type guard that determines whether a given element is a tracked entry element.
 *
 * @param element - Candidate element.
 * @returns `true` if the element exposes a valid `ctflEntryId` dataset property.
 *
 * @public
 */
export function isEntryElement(element?: Element): element is EntryElement {
  if (typeof HTMLElement === 'undefined' || typeof SVGElement === 'undefined') return false
  if (!(element instanceof HTMLElement || element instanceof SVGElement)) return false

  const {
    dataset: { ctflEntryId: entryId },
  } = element
  return typeof entryId === 'string' && entryId.trim().length > 0
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

  const { entryId } = data as Partial<EntryData>
  return typeof entryId === 'string' && entryId.trim().length > 0
}

function parseSticky(sticky: string | undefined): boolean {
  return (sticky?.trim().toLowerCase() ?? '') === 'true'
}

function parseVariantIndex(variantIndex: string | undefined): number | undefined {
  if (variantIndex === undefined || !/^\d+$/.test(variantIndex)) return undefined
  const n = Number(variantIndex)
  return Number.isSafeInteger(n) ? n : undefined
}

/**
 * Resolve normalized entry metadata directly from an entry element dataset.
 *
 * @param element - Candidate entry element.
 * @returns Parsed entry metadata when the element is a valid entry; otherwise `undefined`.
 *
 * @internal
 */
function resolveEntryDataFromElement(element: Element): EntryData | undefined {
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

/**
 * Resolve normalized entry metadata by preferring explicit data over element dataset data.
 *
 * @param data - Optional explicit data associated with the element.
 * @param element - Candidate entry element.
 * @returns Resolved metadata or `undefined` when no valid data source is available.
 *
 * @internal
 */
function resolveEntryData(data: unknown, element: Element): EntryData | undefined {
  return isEntryData(data) ? data : resolveEntryDataFromElement(element)
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
