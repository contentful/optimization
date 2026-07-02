import type { Document } from '@contentful/rich-text-types'
import type { Entry, EntryFieldTypes, EntrySkeletonType } from 'contentful'
import { createClient } from 'contentful'
import { appConfig } from './config'
import { isRecord } from './util'

export interface ContentEntryFields {
  text?: EntryFieldTypes.Text | EntryFieldTypes.RichText
  nested?: EntryFieldTypes.Array<EntryFieldTypes.EntryLink<ContentEntrySkeleton>>
}

export type ContentEntrySkeleton = EntrySkeletonType<ContentEntryFields>
export type ContentEntry = Entry<ContentEntrySkeleton>
export type RichTextDocument = Document

const ENTRY_INCLUDE_DEPTH = 10
const host = process.env.PUBLIC_CONTENTFUL_CDA_HOST?.trim() ?? ''
const basePath = process.env.PUBLIC_CONTENTFUL_BASE_PATH?.trim()

export const client = createClient({
  accessToken: process.env.PUBLIC_CONTENTFUL_TOKEN?.trim() ?? '',
  environment: process.env.PUBLIC_CONTENTFUL_ENVIRONMENT?.trim() ?? '',
  host,
  insecure: host.includes('localhost'),
  space: process.env.PUBLIC_CONTENTFUL_SPACE_ID?.trim() ?? '',
  ...(basePath ? { basePath } : {}),
})

function isLink(value: unknown): value is { sys: { type: 'Link'; linkType: 'Entry'; id: string } } {
  return (
    isRecord(value) &&
    isRecord(value.sys) &&
    value.sys.type === 'Link' &&
    value.sys.linkType === 'Entry' &&
    typeof value.sys.id === 'string'
  )
}

async function resolveField(value: unknown, visited: Set<string>): Promise<unknown> {
  if (isLink(value)) {
    const fetched = await fetchEntry(value.sys.id)
    if (!fetched) return value
    return resolveLinks(fetched, visited)
  }
  if (Array.isArray(value)) return Promise.all(value.map((item) => resolveField(item, visited)))
  return value
}

async function resolveLinks(entry: ContentEntry, visited: Set<string>): Promise<ContentEntry> {
  if (visited.has(entry.sys.id)) return entry
  visited.add(entry.sys.id)
  const resolvedFields = Object.fromEntries(
    await Promise.all(
      Object.entries(entry.fields).map(async ([key, value]) => [
        key,
        await resolveField(value, visited),
      ]),
    ),
  ) as ContentEntry['fields']
  return { ...entry, fields: resolvedFields }
}

export async function fetchEntry(entryId: string): Promise<ContentEntry | undefined> {
  try {
    const entry = await client.getEntry<ContentEntrySkeleton>(entryId, {
      include: ENTRY_INCLUDE_DEPTH,
      locale: appConfig.locale,
    })
    return resolveLinks(entry, new Set())
  } catch {
    return undefined
  }
}
