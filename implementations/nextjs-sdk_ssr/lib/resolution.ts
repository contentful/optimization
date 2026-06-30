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

type Profile = Parameters<typeof optimization.getMergeTagValue>[1]
type SelectedOptimizations = Parameters<typeof optimization.resolveOptimizedEntry>[1]

export interface ResolvedEntry extends Omit<ContentEntry, 'fields'> {
  fields: Omit<ContentEntry['fields'], 'nested'> & {
    nested?: Entry[]
  }
}

export interface Entry {
  baselineEntry: ContentEntry
  /** Raw resolved data for the SDK (ServerOptimizedEntry). entry is a vanilla ContentEntry. */
  resolvedData: ServerTrackingResolvedData
  /** Resolved entry for rendering — fields.nested contains resolved Entry children. */
  resolvedEntry: ResolvedEntry
}

export interface ResolvedPageData {
  resolve(ids: readonly string[]): Entry[]
  get(id: string): Entry | undefined
}

function substituteMergeTags(doc: RichTextDocument, profile: Profile): RichTextDocument {
  const walk = (node: unknown): unknown => {
    if (!isRecord(node)) return node
    if (node.nodeType === INLINES.EMBEDDED_ENTRY && isRecord(node.data) && 'target' in node.data) {
      const value = optimization.getMergeTagValue(node.data.target as never, profile) ?? ''
      return { ...node, data: { ...node.data, resolvedValue: value } }
    }
    if (Array.isArray(node.content)) return { ...node, content: node.content.map(walk) }
    return node
  }
  return walk(doc) as RichTextDocument
}

function applyMergeTags(entry: ContentEntry, profile: Profile): ContentEntry {
  const fields = Object.fromEntries(
    Object.entries(entry.fields).map(([key, value]) => {
      if (isRecord(value) && value.nodeType === 'document' && Array.isArray(value.content)) {
        return [key, substituteMergeTags(value as unknown as RichTextDocument, profile)]
      }
      return [key, value]
    }),
  ) as ContentEntry['fields']
  return { ...entry, fields }
}

function buildEntry(
  baselineEntry: ContentEntry,
  selectedOptimizations: SelectedOptimizations,
  registry: Map<string, ContentEntry>,
  profile: Profile,
  visited: Set<string>,
): Entry {
  visited.add(baselineEntry.sys.id)

  const resolvedData = {
    ...optimization.resolveOptimizedEntry(baselineEntry, selectedOptimizations),
    entry: resolveEntryLinks(
      optimization.resolveOptimizedEntry(baselineEntry, selectedOptimizations)
        .entry as ContentEntry,
      registry,
    ),
  } as ServerTrackingResolvedData

  const withMergeTags = applyMergeTags(resolvedData.entry as ContentEntry, profile)

  const nestedBaselines = Array.isArray(withMergeTags.fields.nested)
    ? withMergeTags.fields.nested.filter(isEntry)
    : []

  const nested = nestedBaselines
    .filter((n) => !visited.has(n.sys.id))
    .map((n) => buildEntry(n, selectedOptimizations, registry, profile, new Set(visited)))

  const resolvedEntry: ResolvedEntry = {
    ...withMergeTags,
    fields: { ...withMergeTags.fields, nested: nested.length > 0 ? nested : undefined },
  }

  return { baselineEntry, resolvedData, resolvedEntry }
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

  const byId = new Map(
    entries.map((entry) => [
      entry.sys.id,
      buildEntry(entry, selectedOptimizations, registry, profile, new Set()),
    ]),
  )

  return {
    resolve: (ids) =>
      ids.flatMap((id) => {
        const e = byId.get(id)
        return e ? [e] : []
      }),
    get: (id) => byId.get(id),
  }
}
