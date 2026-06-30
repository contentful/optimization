import {
  createNextjsOptimization,
  getNextjsServerOptimizationData,
  type ServerTrackingResolvedData,
} from '@contentful/optimization-nextjs/server'
import { INLINES } from '@contentful/rich-text-types'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { appConfig } from './config'
import { fetchEntry, type ContentEntry } from './contentful'
import { getAppConsent, isEntry, isRecord, isRichTextField } from './util'

type Profile = Parameters<ReturnType<typeof createNextjsOptimization>['getMergeTagValue']>[1]
type SelectedOptimizations = Parameters<
  ReturnType<typeof createNextjsOptimization>['resolveOptimizedEntry']
>[1]

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

class ServerOptimization {
  // --- private ---

  private readonly sdk = createNextjsOptimization({
    clientId: appConfig.clientId,
    environment: appConfig.environment,
    locale: appConfig.locale,
    logLevel: 'debug',
    api: appConfig.api,
    app: {
      name: 'Contentful Optimization Next.js SDK SSR (Server)',
      version: '0.1.0',
    },
  })

  private readonly fetchOptimizationData = cache(async () => {
    const cookieStore = await cookies()
    const headerStore = await headers()
    const hasConsent = getAppConsent(cookieStore)
    const { data } = await getNextjsServerOptimizationData(this.sdk, {
      consent: { events: hasConsent, persistence: hasConsent },
      cookies: hasConsent ? cookieStore : undefined,
      headers: headerStore,
      locale: appConfig.locale,
    })

    return { data, hasConsent }
  })

  private resolveMergeTags(
    fields: ContentEntry['fields'],
    profile: Profile,
  ): ContentEntry['fields'] {
    const resolveNode = (node: unknown): unknown => {
      if (!isRecord(node)) return node
      if (
        node.nodeType === INLINES.EMBEDDED_ENTRY &&
        isRecord(node.data) &&
        'target' in node.data
      ) {
        const value = this.sdk.getMergeTagValue(node.data.target as never, profile) ?? ''
        return { ...node, data: { ...node.data, resolvedValue: value } }
      }
      if (Array.isArray(node.content)) {
        return { ...node, content: node.content.map(resolveNode) }
      }
      return node
    }

    return Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        isRichTextField(value) ? resolveNode(value) : value,
      ]),
    ) as ContentEntry['fields']
  }

  private buildEntry(
    baselineEntry: ContentEntry,
    selectedOptimizations: SelectedOptimizations,
    profile: Profile,
    visited: Set<string>,
  ): Entry {
    visited.add(baselineEntry.sys.id)

    const resolved = this.sdk.resolveOptimizedEntry(baselineEntry, selectedOptimizations)
    const resolvedData = resolved as ServerTrackingResolvedData
    const resolvedEntry = resolvedData.entry as ContentEntry
    const fields = this.resolveMergeTags(resolvedEntry.fields, profile)

    const nested = (Array.isArray(fields.nested) ? fields.nested.filter(isEntry) : [])
      .filter((n) => !visited.has(n.sys.id))
      .map((n) => this.buildEntry(n, selectedOptimizations, profile, new Set(visited)))

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

  // --- public ---

  public async getServerState() {
    const { data, hasConsent } = await this.fetchOptimizationData()
    const defaults = data
      ? {
          profile: data.profile,
          ...(hasConsent
            ? { selectedOptimizations: data.selectedOptimizations, changes: data.changes }
            : {}),
        }
      : undefined
    return {
      ...defaults,
      initialPageEvent: hasConsent ? ('skip' as const) : ('emit' as const),
      hasConsent,
    }
  }

  public async getEntry(id: string): Promise<Entry | undefined> {
    const entry = await fetchEntry(id)
    if (!entry) return undefined
    const { data } = await this.fetchOptimizationData()
    return this.buildEntry(entry, data?.selectedOptimizations, data?.profile, new Set())
  }

  public async getEntries(ids: readonly string[]): Promise<Entry[]> {
    const results = await Promise.all(ids.map((id) => this.getEntry(id)))
    return results.filter((e): e is Entry => e !== undefined)
  }
}

export const optimization = new ServerOptimization()
