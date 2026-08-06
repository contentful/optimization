import type { ContentfulEntryQuery, ManagedEntryDescriptor } from './CoreBase'

function stableQuery(query: ContentfulEntryQuery | undefined): string {
  return JSON.stringify(
    Object.entries(query ?? {}).sort(([left], [right]) => (left > right ? 1 : -1)),
  )
}

export function getOptimizedEntrySourceKey(
  entryId: string,
  query: ContentfulEntryQuery | undefined,
): string
export function getOptimizedEntrySourceKey(
  descriptor: Exclude<ManagedEntryDescriptor, string>,
): string
export function getOptimizedEntrySourceKey(
  descriptor: ManagedEntryDescriptor,
  query?: ContentfulEntryQuery,
): string {
  if (typeof descriptor === 'string') return `${descriptor}:${stableQuery(query)}`

  if (descriptor.entryId !== undefined) {
    return `${descriptor.entryId}:${stableQuery(descriptor.entryQuery)}`
  }

  return JSON.stringify([
    'slug',
    descriptor.contentType,
    descriptor.slugField ?? 'slug',
    descriptor.slug,
    stableQuery(descriptor.entryQuery),
  ])
}
