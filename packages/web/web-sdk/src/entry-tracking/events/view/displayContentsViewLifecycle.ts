import { CAN_ADD_LISTENERS, HAS_MUTATION_OBSERVER } from '../../../constants'
import { derefElement, type ElementState } from './element-view-observer-support'

export const collectAffectedDisplayContentsStates = (
  records: readonly MutationRecord[],
  states: ReadonlySet<ElementState>,
): Set<ElementState> => {
  const affected = new Set<ElementState>()

  for (const record of records) {
    for (const state of states) {
      const element = derefElement(state)
      if (!element) continue

      if (record.target === element || element.contains(record.target)) {
        affected.add(state)
      }
    }
  }

  return affected
}

export const syncDisplayContentsMutationObserver = (
  current: MutationObserver | undefined,
  states: ReadonlySet<ElementState>,
  onRecords: (records: readonly MutationRecord[]) => void,
): MutationObserver | undefined => {
  if (!HAS_MUTATION_OBSERVER) return current

  current?.disconnect()

  if (states.size === 0) return undefined

  const observer =
    current ??
    new MutationObserver((records) => {
      onRecords(records)
    })

  for (const state of states) {
    const element = derefElement(state)
    if (!element) continue

    observer.observe(element, {
      attributeFilter: ['class', 'hidden', 'style'],
      attributes: true,
      childList: true,
      subtree: true,
    })
  }

  return observer
}

export const syncVirtualMeasurementListeners = (
  current: (() => void) | undefined,
  hasVirtualStates: boolean,
  schedule: () => void,
  cancel: () => void,
): (() => void) | undefined => {
  if (!CAN_ADD_LISTENERS) return current

  if (!hasVirtualStates) {
    current?.()
    cancel()
    return undefined
  }

  if (current) return current

  const { visualViewport } = window

  window.addEventListener('resize', schedule)
  document.addEventListener('scroll', schedule, true)
  visualViewport?.addEventListener('resize', schedule)
  visualViewport?.addEventListener('scroll', schedule)

  return (): void => {
    window.removeEventListener('resize', schedule)
    document.removeEventListener('scroll', schedule, true)
    visualViewport?.removeEventListener('resize', schedule)
    visualViewport?.removeEventListener('scroll', schedule)
  }
}
