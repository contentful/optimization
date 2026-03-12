import type { EntryInteraction } from './resolveAutoTrackEntryInteractionOptions'
import { isEntryElement } from './resolveTrackingPayload'

function parseBooleanOverride(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false

  return undefined
}

export function resolveEntryInteractionElementOverride(
  interaction: EntryInteraction,
  element: Element,
): boolean | undefined {
  if (!isEntryElement(element)) return undefined

  const datasetValue =
    interaction === 'clicks'
      ? element.dataset.ctflTrackClicks
      : interaction === 'views'
        ? element.dataset.ctflTrackViews
        : element.dataset.ctflTrackHovers

  return parseBooleanOverride(datasetValue)
}
