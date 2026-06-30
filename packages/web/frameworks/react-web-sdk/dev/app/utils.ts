import {
  isMergeTagEntry,
  isRecord,
  isRichTextNode,
  type MergeTagEntry,
} from '@contentful/optimization-api-schemas'
import type { Entry } from 'contentful'
import type { DatasetSnapshot } from './types'

export function getFieldText(field: unknown): string {
  if (typeof field === 'string') return field

  if (isRichTextNode(field)) {
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

export function extractMergeTagEntry(entry: Entry): MergeTagEntry | undefined {
  const richTextField = Object.values(entry.fields).find(isRichTextNode)
  if (!richTextField) return undefined

  function traverse(node: unknown): MergeTagEntry | undefined {
    if (!isRichTextNode(node)) return undefined

    const { data } = node
    if (node.nodeType === 'embedded-entry-inline' && isMergeTagEntry(data.target)) {
      return data.target
    }

    if (isRecord(node) && Array.isArray(node.content)) {
      for (const child of node.content) {
        const found = traverse(child)
        if (found) return found
      }
    }

    return undefined
  }

  return traverse(richTextField)
}
