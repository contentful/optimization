import type Optimization from '@contentful/optimization-react-native'
import { createClient, type Entry } from 'contentful'
import AsyncStorageStore from '../../src/storage/AsyncStorageStore'
import { ENV_CONFIG } from '../env.config'
import type { SDKInfo } from '../types'

export async function initializeSDK(
  setSdkInfo: (info: SDKInfo) => void,
  setSdk: (sdk: Optimization) => void,
  setSdkLoaded: (loaded: boolean) => void,
  setSdkError: (error: string | null) => void,
): Promise<void> {
  const { default: Optimization } = await import('@contentful/optimization-react-native')

  try {
    const {
      optimization: { clientId, environment },
      api: { experienceBaseUrl, insightsBaseUrl },
    } = ENV_CONFIG

    await AsyncStorageStore.initialize()
    AsyncStorageStore.consent = true

    const sdkInstance = await Optimization.create({
      clientId,
      environment,
      api: {
        personalization: { baseUrl: experienceBaseUrl },
        analytics: { baseUrl: insightsBaseUrl },
      },
      logLevel: 'debug',
    })

    setSdkInfo({
      clientId,
      environment,
      initialized: true,
      timestamp: new Date().toISOString(),
    })
    setSdk(sdkInstance)
    setSdkLoaded(true)
  } catch (error) {
    setSdkError(error instanceof Error ? error.message : 'Unknown error')
  }
}

export async function fetchEntriesFromMockServer(
  setPersonalizedEntry: (entry: Entry) => void,
  setProductEntry: (entry: Entry) => void,
): Promise<void> {
  const {
    contentful: { spaceId, environment, accessToken, host, basePath },
    entries: { personalized, product },
  } = ENV_CONFIG

  const contentful = createClient({
    space: spaceId,
    environment,
    accessToken,
    host,
    basePath,
    insecure: true,
  })

  const [personalizedEntryData, productEntryData] = await Promise.all([
    contentful.getEntry(personalized, { include: 10 }),
    contentful.getEntry(product, { include: 10 }),
  ])

  setPersonalizedEntry(personalizedEntryData)
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
