import {
  type OptimizationData,
  type ServerTrackingResolvedData,
} from '@contentful/optimization-nextjs/server'
import {
  buildEntryRegistry,
  extendEntryRegistry,
  loadPageEntries,
  type ContentEntry,
} from './contentful'
import { getOptimizationData, optimization } from './optimization'
import { resolveEntryLinks } from './util'

type SelectedOptimizations = Parameters<typeof optimization.resolveOptimizedEntry>[1]

export interface PageEntry {
  baselineEntry: ContentEntry
  resolvedData: ServerTrackingResolvedData
}

export interface ResolvedPageData {
  registry: Map<string, ContentEntry>
  resolvedById: Map<string, PageEntry>
  optimizationData: OptimizationData | undefined
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

  return { registry, resolvedById, optimizationData }
}

export function makeResolveEntry(
  selectedOptimizations: SelectedOptimizations,
  registry: Map<string, ContentEntry>,
): (entry: ContentEntry) => ServerTrackingResolvedData {
  return (entry) => {
    const resolved = optimization.resolveOptimizedEntry(entry, selectedOptimizations)
    return { ...resolved, entry: resolveEntryLinks(resolved.entry as ContentEntry, registry) }
  }
}

export function makeGetMergeTagValue(
  profile: Parameters<typeof optimization.getMergeTagValue>[1],
): (entry: unknown) => string | undefined {
  return (entry) => optimization.getMergeTagValue(entry as never, profile)
}
