import { isRecord } from '@contentful/optimization-angular'
import type { ContentfulEntry } from '../types/contentful'

export { isRecord }

export function isNestedContentEntry(entry: ContentfulEntry): boolean {
  const ct: unknown = entry.sys.contentType
  if (!isRecord(ct) || !isRecord(ct.sys)) return false
  return ct.sys.id === 'nestedContent'
}

export function isEntry(value: unknown): value is ContentfulEntry {
  return (
    isRecord(value) &&
    isRecord(value.sys) &&
    typeof value.sys.id === 'string' &&
    isRecord(value.fields)
  )
}

export function getSelectedOptimizationMeta(value: unknown): {
  experienceId: string | undefined
  sticky: boolean | undefined
  variantIndex: number | undefined
} {
  if (!isRecord(value))
    return { experienceId: undefined, sticky: undefined, variantIndex: undefined }
  return {
    experienceId: typeof value.experienceId === 'string' ? value.experienceId : undefined,
    sticky: typeof value.sticky === 'boolean' ? value.sticky : undefined,
    variantIndex: typeof value.variantIndex === 'number' ? value.variantIndex : undefined,
  }
}
