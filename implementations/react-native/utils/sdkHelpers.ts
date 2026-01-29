import Optimization, { logger } from '@contentful/optimization-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type Entry } from 'contentful'
import AsyncStorageStore from '../../../platforms/javascript/react-native/src/storage/AsyncStorageStore'
import { ENV_CONFIG } from '../env.config'

const LOG_LOCATION = 'Demo:Helpers'
const INCLUDE_DEPTH = 10

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

export async function initializeSDK(
  setSdk: (sdk: Awaited<ReturnType<typeof Optimization.create>>) => void,
  setSdkError: (error: string) => void,
): Promise<void> {
  try {
    await AsyncStorageStore.initialize()
    AsyncStorageStore.consent = true

    const sdkInstance = await Optimization.create({
      clientId: ENV_CONFIG.optimization.clientId,
      environment: ENV_CONFIG.optimization.environment,
      personalization: { baseUrl: ENV_CONFIG.api.experienceBaseUrl },
      analytics: { baseUrl: ENV_CONFIG.api.insightsBaseUrl },
      logLevel: 'debug',
    })

    setSdk(sdkInstance)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    setSdkError(`Failed to initialize SDK: ${errorMessage}`)
  }
}

export async function fetchEntries(
  entryIds: string[],
  setEntries: (entries: Entry[]) => void,
  setSdkError: (error: string) => void,
): Promise<void> {
  try {
    const client = createContentfulClient()
    const fetchedEntries: Entry[] = []

    for (const entryId of entryIds) {
      try {
        const entry = await client.getEntry(entryId, {
          include: INCLUDE_DEPTH,
        })

        fetchedEntries.push(entry)
        logger.debug(LOG_LOCATION, `Fetched entry ${entryId}`)
      } catch (_error: unknown) {
        logger.warn(LOG_LOCATION, `Entry "${entryId}" could not be found in the current space`)
      }
    }

    setEntries(fetchedEntries)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorText = `Failed to fetch entries: ${errorMessage}`
    logger.error(LOG_LOCATION, errorText)
    setSdkError(errorText)
  }
}

export async function clearProfileState(): Promise<void> {
  try {
    const keys = ['__ctfl_opt_profile__', '__ctfl_opt_personalizations__', '__ctfl_opt_changes__']
    await AsyncStorage.multiRemove(keys)
    logger.info(LOG_LOCATION, 'Profile state cleared successfully')
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error(LOG_LOCATION, `Failed to clear profile state: ${errorMessage}`)
  }
}
