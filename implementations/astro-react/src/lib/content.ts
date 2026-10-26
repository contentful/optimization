import { createClient, type Entry, type EntryFieldTypes, type EntrySkeletonType } from 'contentful'
import { APP_LOCALE, optimizationConfig } from './config'

type ContentSkeleton = EntrySkeletonType<{ text: EntryFieldTypes.Text }>
export type ContentEntry = Entry<ContentSkeleton>
const INCLUDE_DEPTH = 10

export async function fetchBaseline(): Promise<ContentEntry> {
  const host = import.meta.env.CONTENTFUL_CDA_HOST ?? 'cdn.contentful.com'
  const client = createClient({
    space: optimizationConfig.spaceId,
    environment: optimizationConfig.environment,
    accessToken: import.meta.env.CONTENTFUL_TOKEN ?? '',
    host,
    basePath: import.meta.env.CONTENTFUL_BASE_PATH,
    insecure: host.startsWith('localhost:'),
  })
  return await client.getEntry<ContentSkeleton>(import.meta.env.CONTENTFUL_ENTRY_ID ?? '', {
    locale: APP_LOCALE,
    include: INCLUDE_DEPTH,
  })
}
