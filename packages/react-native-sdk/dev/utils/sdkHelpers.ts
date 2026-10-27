import { createClient, type Entry } from 'contentful'
import { ENV_CONFIG } from '../env.config'

export async function fetchEntriesFromMockServer(
  setOptimizedEntry: (entry: Entry) => void,
  setProductEntry: (entry: Entry) => void,
): Promise<void> {
  const {
    contentful: { spaceId, environment, accessToken, host, basePath },
    entries: { optimized, product },
  } = ENV_CONFIG

  const contentful = createClient({
    space: spaceId,
    environment,
    accessToken,
    host,
    basePath,
    insecure: true,
  })

  const [optimizedEntryData, productEntryData] = await Promise.all([
    contentful.getEntry(optimized, { include: 10 }),
    contentful.getEntry(product, { include: 10 }),
  ])

  setOptimizedEntry(optimizedEntryData)
  setProductEntry(productEntryData)
}

export async function fetchMergeTagEntry(setMergeTagEntry: (entry: Entry) => void): Promise<void> {
  const {
    contentful: { spaceId, environment, accessToken, host, basePath },
    entries: { mergeTag },
  } = ENV_CONFIG

  const contentful = createClient({
    space: spaceId,
    environment,
    accessToken,
    host,
    basePath,
    insecure: true,
  })

  const response = await contentful.getEntries({
    'sys.id': mergeTag,
    include: 10,
  })

  const { items, includes } = response
  const [firstItem] = items

  if (!firstItem) {
    throw new Error(`Merge tag entry with ID ${mergeTag} not found`)
  }

  const mergeTagEntryData: Entry & {
    includes?: {
      Entry?: Entry[]
    }
  } = firstItem

  if (includes?.Entry) {
    mergeTagEntryData.includes = { Entry: includes.Entry }
  }

  setMergeTagEntry(mergeTagEntryData)
}

export interface DemoEntries {
  deviceType: Entry
  visitorType: Entry
  location: Entry
  customEvent: Entry
}

export async function fetchDemoEntries(): Promise<DemoEntries> {
  const {
    contentful: { spaceId, environment, accessToken, host, basePath },
    entries: { deviceType, visitorType, location, customEvent },
  } = ENV_CONFIG

  const contentful = createClient({
    space: spaceId,
    environment,
    accessToken,
    host,
    basePath,
    insecure: true,
  })

  const [deviceTypeEntry, visitorTypeEntry, locationEntry, customEventEntry] = await Promise.all([
    contentful.getEntry(deviceType, { include: 10 }),
    contentful.getEntry(visitorType, { include: 10 }),
    contentful.getEntry(location, { include: 10 }),
    contentful.getEntry(customEvent, { include: 10 }),
  ])

  return {
    deviceType: deviceTypeEntry,
    visitorType: visitorTypeEntry,
    location: locationEntry,
    customEvent: customEventEntry,
  }
}
