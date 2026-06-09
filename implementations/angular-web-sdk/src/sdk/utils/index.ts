import type { MergeTagEntry } from '@contentful/optimization-web/api-schemas'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isMergeTagEntry(entry: unknown): entry is MergeTagEntry {
  if (!isRecord(entry) || !isRecord(entry.sys)) return false
  if (!isRecord(entry.sys.contentType)) return false
  if (!isRecord(entry.sys.contentType.sys)) return false
  return entry.sys.contentType.sys.id === 'nt_mergetag'
}
