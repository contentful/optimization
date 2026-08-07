import type { Entry } from 'contentful'
import type { ContentfulEntryQuery, ManagedEntryDescriptor, ManagedEntryHandoff } from './CoreBase'

export type NormalizedManagedEntryDescriptor =
  | {
      readonly entryId: string
      readonly entryQuery?: ContentfulEntryQuery
    }
  | {
      readonly contentType: string
      readonly slug: string
      readonly slugField: string
      readonly entryQuery?: ContentfulEntryQuery
    }

export function normalizeManagedEntryDescriptor(
  descriptor: ManagedEntryDescriptor,
): NormalizedManagedEntryDescriptor {
  if (typeof descriptor === 'string') return { entryId: descriptor }
  if (descriptor.entryId !== undefined) return descriptor
  return { ...descriptor, slugField: descriptor.slugField ?? 'slug' }
}

export function createManagedEntryHandoffs(
  entries: readonly ManagedEntryDescriptor[],
  baselineEntries: ReadonlyArray<Entry | undefined>,
): ManagedEntryHandoff[] {
  return entries.map((entry, index) => {
    const descriptor = normalizeManagedEntryDescriptor(entry)
    const { [index]: baselineEntry } = baselineEntries

    if (baselineEntry === undefined) {
      const source = 'entryId' in descriptor ? descriptor.entryId : descriptor.slug
      throw new Error(`Contentful entry "${source}" was not returned.`)
    }

    if ('entryId' in descriptor) {
      return {
        ...(descriptor.entryQuery === undefined ? {} : { entryQuery: descriptor.entryQuery }),
        baselineEntry,
        entryId: descriptor.entryId,
      }
    }

    return { baselineEntry, entryId: baselineEntry.sys.id, managedEntry: descriptor }
  })
}
