import type { Entry } from 'contentful'
import type { ContentfulEntryQuery, ManagedEntryDescriptor, ManagedEntryHandoff } from './CoreBase'

export interface NormalizedManagedEntryDescriptor {
  readonly entryId: string
  readonly entryQuery?: ContentfulEntryQuery
}

export function normalizeManagedEntryDescriptor(
  descriptor: ManagedEntryDescriptor,
): NormalizedManagedEntryDescriptor {
  return typeof descriptor === 'string' ? { entryId: descriptor } : descriptor
}

export function createManagedEntryHandoffs(
  entries: readonly ManagedEntryDescriptor[],
  baselineEntries: ReadonlyArray<Entry | undefined>,
): ManagedEntryHandoff[] {
  return entries.map((entry, index) => {
    const { entryId, entryQuery } = normalizeManagedEntryDescriptor(entry)
    const { [index]: baselineEntry } = baselineEntries

    if (baselineEntry === undefined) {
      throw new Error(`Contentful entry "${entryId}" was not returned.`)
    }

    return {
      ...(entryQuery === undefined ? {} : { entryQuery }),
      baselineEntry,
      entryId,
    }
  })
}
