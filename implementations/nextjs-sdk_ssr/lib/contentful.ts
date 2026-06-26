import type { Document } from '@contentful/rich-text-types'
import type { Entry, EntryFieldTypes, EntrySkeletonType } from 'contentful'
import { createClient } from 'contentful'
import { appConfig } from './config'

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

async function fetchEntry(entryId: string): Promise<ContentEntry | undefined> {
  try {
    return await client.getEntry<ContentEntrySkeleton>(entryId, {
      include: ENTRY_INCLUDE_DEPTH,
      locale: appConfig.locale,
    })
  } catch {
    return undefined
  }
}

export async function loadPageEntries(entryIds: readonly string[]): Promise<ContentEntry[]> {
  const results = await Promise.all(entryIds.map(fetchEntry))
  return results.filter((entry): entry is ContentEntry => entry !== undefined)
}
