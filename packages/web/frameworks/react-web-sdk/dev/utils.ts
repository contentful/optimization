import type { DatasetSnapshot } from './types'

export function getFieldText(field: unknown): string {
  if (typeof field === 'string') return field

  if (field && typeof field === 'object' && 'nodeType' in field) {
    return '[Rich Text Content]'
  }

  return ''
}

export function toJsonPreview(value: unknown): string {
  if (value === undefined) return 'undefined'

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '[Unserializable value]'
  }
}

export function readTrackingDataset(testId: string): DatasetSnapshot | null {
  const element = document.querySelector(`[data-testid="${testId}"]`)
  if (!(element instanceof HTMLElement)) return null

  return {
    ctflEntryId: element.dataset.ctflEntryId,
    ctflOptimizationId: element.dataset.ctflOptimizationId,
    ctflVariantIndex: element.dataset.ctflVariantIndex,
    ctflSticky: element.dataset.ctflSticky,
    ctflDuplicationScope: element.dataset.ctflDuplicationScope,
  }
}
