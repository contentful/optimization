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
const STATIC_HANDOFF_MISSING_ENTRY_BEHAVIOR =
  process.env.PUBLIC_OPTIMIZATION_STATIC_HANDOFF_MISSING_ENTRY?.trim()

const host = process.env.PUBLIC_CONTENTFUL_CDA_HOST?.trim() ?? ''
const basePath = process.env.PUBLIC_CONTENTFUL_BASE_PATH?.trim()

export type MissingRequiredEntryBehavior = 'not-found' | 'throw'

interface PageEntryResult {
  readonly entry: ContentEntry | undefined
  readonly entryId: string
}

interface LoadRequiredPageEntriesOptions {
  readonly onMissingEntry?: MissingRequiredEntryBehavior
}

function readMissingRequiredEntryBehavior(value: string | undefined): MissingRequiredEntryBehavior {
  if (value === undefined || value === '' || value === 'throw') return 'throw'
  if (value === 'not-found') return 'not-found'

  throw new Error(
    'PUBLIC_OPTIMIZATION_STATIC_HANDOFF_MISSING_ENTRY must be "throw" or "not-found".',
  )
}

export const staticPublicHandoffMissingRequiredEntryBehavior = readMissingRequiredEntryBehavior(
  STATIC_HANDOFF_MISSING_ENTRY_BEHAVIOR,
)

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

async function fetchPageEntries(entryIds: readonly string[]): Promise<PageEntryResult[]> {
  return Promise.all(
    entryIds.map(async (entryId) => ({
      entry: await fetchEntry(entryId),
      entryId,
    })),
  )
}

export async function loadPageEntries(entryIds: readonly string[]): Promise<ContentEntry[]> {
  const results = await fetchPageEntries(entryIds)
  return results.flatMap(({ entry }) => (entry === undefined ? [] : [entry]))
}

export async function loadRequiredPageEntries(
  entryIds: readonly string[],
  options: { readonly onMissingEntry: 'not-found' },
): Promise<ContentEntry[] | undefined>
export async function loadRequiredPageEntries(
  entryIds: readonly string[],
  options?: { readonly onMissingEntry?: 'throw' },
): Promise<ContentEntry[]>
export async function loadRequiredPageEntries(
  entryIds: readonly string[],
  options: LoadRequiredPageEntriesOptions,
): Promise<ContentEntry[] | undefined>
export async function loadRequiredPageEntries(
  entryIds: readonly string[],
  { onMissingEntry = 'throw' }: LoadRequiredPageEntriesOptions = {},
): Promise<ContentEntry[] | undefined> {
  const results = await fetchPageEntries(entryIds)
  const entries = results.flatMap(({ entry }) => (entry === undefined ? [] : [entry]))
  const missingEntryIds = results.flatMap(({ entry, entryId }) =>
    entry === undefined ? [entryId] : [],
  )

  if (missingEntryIds.length === 0) return entries
  if (onMissingEntry === 'not-found') return undefined

  throw new Error(`Missing required Contentful entries: ${missingEntryIds.join(', ')}`)
}
