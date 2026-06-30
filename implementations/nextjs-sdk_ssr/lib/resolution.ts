import {
  getNextjsServerOptimizationData,
  type ServerTrackingResolvedData,
} from '@contentful/optimization-nextjs/server'
import { headers } from 'next/headers'
import { appConfig } from './config'
import { getAppConsent } from './consent'
import { buildEntryRegistry, extendEntryRegistry, type ContentEntry } from './contentful'
import { optimization } from './optimization'
import { resolveEntryLinks, toIdMap } from './util'

type SelectedOptimizations = Parameters<typeof optimization.resolveOptimizedEntry>[1]

type Profile = Parameters<typeof optimization.getMergeTagValue>[1]

export interface ResolvedPageData {
  registry: Map<string, ContentEntry>
  entriesById: Map<string, ContentEntry>
  resolvedById: Map<string, ServerTrackingResolvedData>
}

type CookieStore = Parameters<typeof getAppConsent>[0]

export async function loadOptimizationData(
  cookieStore: CookieStore,
): Promise<Awaited<ReturnType<typeof getNextjsServerOptimizationData>>['data'] | undefined> {
  if (!getAppConsent(cookieStore)) return undefined
  const { data } = await getNextjsServerOptimizationData(optimization, {
    consent: { events: true, persistence: true },
    cookies: cookieStore,
    headers: await headers(),
    locale: appConfig.locale,
  })
  return data
}

export async function resolveOptimizedEntries(
  entries: ContentEntry[],
  selectedOptimizations: SelectedOptimizations,
): Promise<ResolvedPageData> {
  const registry = await buildEntryRegistry(entries)
  const entriesById = toIdMap(entries)

  const resolvedVariants = entries.map((entry) =>
    optimization.resolveOptimizedEntry(entry, selectedOptimizations),
  )
  await extendEntryRegistry(
    registry,
    resolvedVariants.map((r) => r.entry as ContentEntry),
  )

  const resolvedById = new Map(
    entries.map((entry, i) => {
      const resolved = resolvedVariants[i]!
      const resolvedEntry = resolveEntryLinks(resolved.entry as ContentEntry, registry)
      return [entry.sys.id, { ...resolved, entry: resolvedEntry }] as const
    }),
  )

  return { registry, entriesById, resolvedById }
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

export function makeGetMergeTagValue(profile: Profile): (entry: unknown) => string | undefined {
  return (entry) => optimization.getMergeTagValue(entry as never, profile)
}
