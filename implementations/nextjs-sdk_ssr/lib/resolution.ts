import { type ServerTrackingResolvedData } from '@contentful/optimization-nextjs/server'
import { INLINES } from '@contentful/rich-text-types'
import {
  buildEntryRegistry,
  extendEntryRegistry,
  loadPageEntries,
  type ContentEntry,
  type RichTextDocument,
} from './contentful'
import { getOptimizationData, optimization } from './optimization'
import { isEntry, isRecord, resolveEntryLinks } from './util'

export interface PageEntry {
  baselineEntry: ContentEntry
  resolvedData: ServerTrackingResolvedData
}

export interface ResolvedPageData {
  resolvedById: Map<string, PageEntry>
}

function resolveVariant(
  entry: ContentEntry,
  selectedOptimizations: Parameters<typeof optimization.resolveOptimizedEntry>[1],
  registry: Map<string, ContentEntry>,
): ServerTrackingResolvedData {
  const resolved = optimization.resolveOptimizedEntry(entry, selectedOptimizations)
  return { ...resolved, entry: resolveEntryLinks(resolved.entry as ContentEntry, registry) }
}

function substituteMergeTags(
  doc: RichTextDocument,
  profile: Parameters<typeof optimization.getMergeTagValue>[1],
): RichTextDocument {
  const walk = (node: unknown): unknown => {
    if (!isRecord(node)) return node
    if (node.nodeType === INLINES.EMBEDDED_ENTRY && isRecord(node.data) && 'target' in node.data) {
      const value = optimization.getMergeTagValue(node.data.target as never, profile) ?? ''
      return { ...node, data: { ...node.data, resolvedValue: value } }
    }
    if (Array.isArray(node.content)) {
      return { ...node, content: node.content.map(walk) }
    }
    return node
  }
  return walk(doc) as RichTextDocument
}

function applyMergeTagsToEntry(
  entry: ContentEntry,
  profile: Parameters<typeof optimization.getMergeTagValue>[1],
): ContentEntry {
  const fields = Object.fromEntries(
    Object.entries(entry.fields).map(([key, value]) => {
      if (isRecord(value) && value.nodeType === 'document' && Array.isArray(value.content)) {
        return [key, substituteMergeTags(value as unknown as RichTextDocument, profile)]
      }
      if (Array.isArray(value)) {
        return [
          key,
          value.map((item) => (isEntry(item) ? applyMergeTagsToEntry(item, profile) : item)),
        ]
      }
      if (isEntry(value)) return [key, applyMergeTagsToEntry(value, profile)]
      return [key, value]
    }),
  ) as ContentEntry['fields']
  return { ...entry, fields }
}

export async function loadPageData(entryIds: readonly string[]): Promise<ResolvedPageData> {
  const [entries, { data: optimizationData }] = await Promise.all([
    loadPageEntries(entryIds),
    getOptimizationData(),
  ])
  const selectedOptimizations = optimizationData?.selectedOptimizations
  const profile = optimizationData?.profile
  const registry = await buildEntryRegistry(entries)

  const resolvedVariants = entries.map((entry) =>
    optimization.resolveOptimizedEntry(entry, selectedOptimizations),
  )
  await extendEntryRegistry(
    registry,
    resolvedVariants.map((r) => r.entry as ContentEntry),
  )

  // Build a fully-resolved variant map for every entry in the registry so
  // nested entries can be looked up without re-running resolveOptimizedEntry at render time.
  const resolvedRegistry = new Map<string, ServerTrackingResolvedData>()
  for (const [id, entry] of registry) {
    resolvedRegistry.set(id, resolveVariant(entry, selectedOptimizations, registry))
  }

  const resolvedById = new Map(
    entries.map((baselineEntry, i) => {
      const resolved = resolvedVariants[i]!
      const resolvedEntry = resolveEntryLinks(resolved.entry as ContentEntry, registry)

      // Replace nested entries with their resolved variants from the registry.
      const nestedFields = Object.fromEntries(
        Object.entries(resolvedEntry.fields).map(([key, value]) => {
          if (Array.isArray(value)) {
            return [
              key,
              value.map((item) =>
                isEntry(item) ? (resolvedRegistry.get(item.sys.id)?.entry ?? item) : item,
              ),
            ]
          }
          return [key, value]
        }),
      ) as ContentEntry['fields']

      const fullyResolvedEntry = applyMergeTagsToEntry(
        { ...resolvedEntry, fields: nestedFields },
        profile,
      )

      return [
        baselineEntry.sys.id,
        { baselineEntry, resolvedData: { ...resolved, entry: fullyResolvedEntry } },
      ] as const
    }),
  )

  return { resolvedById }
}
