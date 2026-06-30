import { type ServerTrackingResolvedData } from '@contentful/optimization-nextjs/server'
import {
  buildEntryRegistry,
  extendEntryRegistry,
  loadPageEntries,
  type ContentEntry,
} from './contentful'
import { getOptimizationData, optimization } from './optimization'
import { resolveEntryLinks } from './util'

export interface PageEntry {
  baselineEntry: ContentEntry
  resolvedData: ServerTrackingResolvedData
}

export interface ResolvedPageData {
  resolvedById: Map<string, PageEntry>
  getMergeTagValue: (entry: unknown) => string | undefined
  resolveEntry: (entry: ContentEntry) => ServerTrackingResolvedData
}

export async function loadPageData(entryIds: readonly string[]): Promise<ResolvedPageData> {
  const [entries, { data: optimizationData }] = await Promise.all([
    loadPageEntries(entryIds),
    getOptimizationData(),
  ])
  const selectedOptimizations = optimizationData?.selectedOptimizations
  const registry = await buildEntryRegistry(entries)

  const resolvedVariants = entries.map((entry) =>
    optimization.resolveOptimizedEntry(entry, selectedOptimizations),
  )
  await extendEntryRegistry(
    registry,
    resolvedVariants.map((r) => r.entry as ContentEntry),
  )

  const resolvedById = new Map(
    entries.map((baselineEntry, i) => {
      const resolved = resolvedVariants[i]!
      const resolvedEntry = resolveEntryLinks(resolved.entry as ContentEntry, registry)
      return [
        baselineEntry.sys.id,
        { baselineEntry, resolvedData: { ...resolved, entry: resolvedEntry } },
      ] as const
    }),
  )

  const getMergeTagValue = (entry: unknown) =>
    optimization.getMergeTagValue(entry as never, optimizationData?.profile)

  const resolveEntry = (entry: ContentEntry): ServerTrackingResolvedData => {
    const resolved = optimization.resolveOptimizedEntry(entry, selectedOptimizations)
    return { ...resolved, entry: resolveEntryLinks(resolved.entry as ContentEntry, registry) }
  }

  return { resolvedById, getMergeTagValue, resolveEntry }
}
