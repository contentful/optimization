import type { EntryInteraction } from './resolveAutoTrackEntryInteractionOptions'
import { isEntryElement } from './resolveComponentTrackingPayload'

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

  return parseBooleanOverride(
    interaction === 'clicks' ? element.dataset.ctflTrackClicks : element.dataset.ctflTrackViews,
  )
}
