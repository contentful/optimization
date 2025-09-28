import type { Entry as ContentfulEntry } from 'contentful'
import { z } from 'zod/mini'
import { Entry, EntryFields, Link } from './Entry'

export const OptimizedEntry = z.extend(Entry, {
  fields: z.extend(EntryFields, {
    nt_experiences: z.array(z.union([Link, Entry])),
  }),
})
export type OptimizedEntry = z.infer<typeof OptimizedEntry>

export function isOptimizedEntry(entry: ContentfulEntry | undefined): entry is OptimizedEntry {
  return OptimizedEntry.safeParse(entry).success
}
