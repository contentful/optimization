import type Optimization from '@contentful/optimization-react-native'
import { logger } from '@contentful/optimization-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type Entry } from 'contentful'
import AsyncStorageStore from '../../../platforms/javascript/react-native/src/storage/AsyncStorageStore'
import { ENV_CONFIG } from '../env.config'

const INCLUDE_DEPTH = 10
const {
  entries: { mergeTag: MERGE_TAG_ENTRY_ID, personalized: PERSONALIZATION_ENTRY_ID },
} = ENV_CONFIG
const ANALYTICS_ENTRY_ID = PERSONALIZATION_ENTRY_ID

function createContentfulClient(): ReturnType<typeof createClient> {
  return createClient({
    space: ENV_CONFIG.contentful.spaceId,
    environment: ENV_CONFIG.contentful.environment,
    accessToken: ENV_CONFIG.contentful.accessToken,
    host: ENV_CONFIG.contentful.host,
    basePath: ENV_CONFIG.contentful.basePath,
    insecure: true,
  })
}

interface FetchEntryOptions {
  entryId: string
  setEntry: (entry: Entry | null) => void
  setSdkError: (error: string) => void
  errorPrefix: string
  includeIncludes?: boolean
}

async function fetchEntry({
  entryId,
  setEntry,
  setSdkError,
  errorPrefix,
  includeIncludes = false,
}: FetchEntryOptions): Promise<void> {
  try {
    const client = createContentfulClient()
    const response = await client.getEntries({
      'sys.id': entryId,
      include: INCLUDE_DEPTH,
    })

    const { items, includes } = response
    const [firstItem] = items

    if (!firstItem) {
      throw new Error(`Entry with ID ${entryId} not found`)
    }

    if (includeIncludes && includes?.Entry) {
      const entry: Entry & {
        includes?: {
          Entry?: Entry[]
        }
      } = {
        ...firstItem,
        includes: { Entry: includes.Entry },
      }
      setEntry(entry)
      return
    }

    setEntry(firstItem)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorText = `${errorPrefix}: ${errorMessage}`
    logger.error(errorText)
    setSdkError(errorText)
  }
}

export async function initializeSDK(
  setSdk: (sdk: Optimization) => void,
  setSdkError: (error: string) => void,
): Promise<void> {
  try {
    const { default: OptimizationSDK } = await import('@contentful/optimization-react-native')
    await AsyncStorageStore.initialize()
    AsyncStorageStore.consent = true

    const sdkInstance = await OptimizationSDK.create({
      clientId: ENV_CONFIG.optimization.clientId,
      environment: ENV_CONFIG.optimization.environment,
      api: {
        personalization: { baseUrl: ENV_CONFIG.api.experienceBaseUrl },
        analytics: { baseUrl: ENV_CONFIG.api.insightsBaseUrl },
      },
      logLevel: 'debug',
    })

    setSdk(sdkInstance)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    setSdkError(`Failed to initialize SDK: ${errorMessage}`)
  }
}

export async function fetchMergeTagEntry(
  setMergeTagEntry: (entry: Entry | null) => void,
  setSdkError: (error: string) => void,
): Promise<void> {
  await fetchEntry({
    entryId: MERGE_TAG_ENTRY_ID,
    setEntry: setMergeTagEntry,
    setSdkError,
    errorPrefix: 'Failed to fetch merge tag entry',
    includeIncludes: true,
  })
}

export async function fetchPersonalizationEntry(
  setPersonalizationEntry: (entry: Entry | null) => void,
  setSdkError: (error: string) => void,
): Promise<void> {
  await fetchEntry({
    entryId: PERSONALIZATION_ENTRY_ID,
    setEntry: setPersonalizationEntry,
    setSdkError,
    errorPrefix: 'Failed to fetch personalization entry',
  })
}

export async function fetchAnalyticsEntry(
  setAnalyticsEntry: (entry: Entry | null) => void,
  setSdkError: (error: string) => void,
): Promise<void> {
  await fetchEntry({
    entryId: ANALYTICS_ENTRY_ID,
    setEntry: setAnalyticsEntry,
    setSdkError,
    errorPrefix: `Failed to fetch analytics entry with ID ${ANALYTICS_ENTRY_ID}`,
  })
}

export async function clearProfileState(): Promise<void> {
  try {
    const keys = ['__ctfl_opt_profile__', '__ctfl_opt_personalizations__', '__ctfl_opt_changes__']
    await AsyncStorage.multiRemove(keys)
    logger.info('Profile state cleared successfully')
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Failed to clear profile state: ${errorMessage}`)
  }
}
