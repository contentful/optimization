import type { ContentEntry } from './contentful'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isLink(value: unknown): value is { sys: { type: 'Link'; linkType: 'Entry'; id: string } } {
  return (
    isRecord(value) &&
    isRecord(value.sys) &&
    value.sys.type === 'Link' &&
    value.sys.linkType === 'Entry' &&
    typeof value.sys.id === 'string'
  )
}

export function isEntry(value: unknown): value is ContentEntry {
  return (
    isRecord(value) &&
    isRecord(value.sys) &&
    typeof value.sys.id === 'string' &&
    isRecord(value.fields)
  )
}

function resolveField(
  value: unknown,
  entryMap: Map<string, ContentEntry>,
  visited: Set<string>,
): unknown {
  if (isLink(value)) {
    const resolved = entryMap.get(value.sys.id)
    if (!resolved) return value
    return resolveEntryLinksInternal(resolved, entryMap, visited)
  }
  if (Array.isArray(value)) return value.map((item) => resolveField(item, entryMap, visited))
  return value
}

function resolveEntryLinksInternal(
  entry: ContentEntry,
  entryMap: Map<string, ContentEntry>,
  visited: Set<string>,
): ContentEntry {
  if (visited.has(entry.sys.id)) return entry
  visited.add(entry.sys.id)
  const resolvedFields = Object.fromEntries(
    Object.entries(entry.fields).map(([key, value]) => [
      key,
      resolveField(value, entryMap, visited),
    ]),
  ) as ContentEntry['fields']
  return { ...entry, fields: resolvedFields }
}

export function resolveEntryLinks(
  entry: ContentEntry,
  entryMap: Map<string, ContentEntry>,
): ContentEntry {
  return resolveEntryLinksInternal(entry, entryMap, new Set())
}

export function collectLinkIds(entry: ContentEntry, visited = new Set<string>()): string[] {
  if (visited.has(entry.sys.id)) return []
  visited.add(entry.sys.id)
  const ids: string[] = []
  for (const value of Object.values(entry.fields)) {
    if (isLink(value)) {
      ids.push(value.sys.id)
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (isLink(item)) ids.push(item.sys.id)
        else if (isEntry(item)) ids.push(...collectLinkIds(item, visited))
      }
    } else if (isEntry(value)) {
      ids.push(...collectLinkIds(value, visited))
    }
  }
  return ids
}

export function toIdMap<T extends { sys: { id: string } }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.sys.id, item]))
}
