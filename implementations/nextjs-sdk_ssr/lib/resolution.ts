import { type ServerTrackingResolvedData } from '@contentful/optimization-nextjs/server'
import { INLINES } from '@contentful/rich-text-types'
import {
  extendEntryRegistry,
  loadPageEntries,
  type ContentEntry,
  type RichTextDocument,
} from './contentful'
import { getOptimizationData, optimization } from './optimization'
import { isEntry, isRecord, resolveEntryLinks, toIdMap } from './util'

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

function resolveMergeTagNode(node: unknown, profile: Profile): unknown {
  if (!isRecord(node)) return node
  if (node.nodeType === INLINES.EMBEDDED_ENTRY && isRecord(node.data) && 'target' in node.data) {
    const value = optimization.getMergeTagValue(node.data.target as never, profile) ?? ''
    return { ...node, data: { ...node.data, resolvedValue: value } }
  }
  if (Array.isArray(node.content)) {
    return { ...node, content: node.content.map((child) => resolveMergeTagNode(child, profile)) }
  }
  return node
}

function resolveMergeTags(
  fields: ContentEntry['fields'],
  profile: Profile,
): ContentEntry['fields'] {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => {
      if (isRecord(value) && value.nodeType === 'document' && Array.isArray(value.content)) {
        return [key, resolveMergeTagNode(value, profile) as RichTextDocument]
      }
      return [key, value]
    }),
  ) as ContentEntry['fields']
}

function buildEntry(
  baselineEntry: ContentEntry,
  selectedOptimizations: SelectedOptimizations,
  registry: Map<string, ContentEntry>,
  profile: Profile,
  visited: Set<string>,
  preResolved?: ReturnType<typeof optimization.resolveOptimizedEntry>,
): Entry {
  visited.add(baselineEntry.sys.id)

  const resolved =
    preResolved ?? optimization.resolveOptimizedEntry(baselineEntry, selectedOptimizations)
  const resolvedData = {
    ...resolved,
    entry: resolveEntryLinks(resolved.entry as ContentEntry, registry),
  } as ServerTrackingResolvedData

  const resolvedEntry = resolvedData.entry as ContentEntry
  const fields = resolveMergeTags(resolvedEntry.fields, profile)

  const nested = (Array.isArray(fields.nested) ? fields.nested.filter(isEntry) : [])
    .filter((n) => !visited.has(n.sys.id))
    .map((n) => buildEntry(n, selectedOptimizations, registry, profile, new Set(visited)))

  return {
    baselineEntry,
    resolvedData,
    resolvedEntry: {
      ...resolvedEntry,
      fields: {
        ...fields,
        nested: nested.length > 0 ? nested : undefined,
      } as unknown as ResolvedEntry['fields'],
    },
  }
}

export async function loadPageData(entryIds: readonly string[]): Promise<ResolvedPageData> {
  const [entries, { data: optimizationData }] = await Promise.all([
    loadPageEntries(entryIds),
    getOptimizationData(),
  ])
  const selectedOptimizations = optimizationData?.selectedOptimizations
  const profile = optimizationData?.profile
  const resolvedVariants = entries.map((entry) =>
    optimization.resolveOptimizedEntry(entry, selectedOptimizations),
  )

  const registry = toIdMap(entries)
  await extendEntryRegistry(registry, [
    ...entries,
    ...resolvedVariants.map((r) => r.entry as ContentEntry),
  ])

  const byId = new Map(
    entries.map((entry, i) => [
      entry.sys.id,
      buildEntry(entry, selectedOptimizations, registry, profile, new Set(), resolvedVariants[i]),
    ]),
  )

  return {
    resolve: (ids) => ids.map((id) => byId.get(id)).filter((e): e is Entry => e !== undefined),
    get: (id) => byId.get(id),
  }
}
