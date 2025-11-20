import type Optimization from '@contentful/optimization-react-native'
import { logger } from '@contentful/optimization-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, type Entry } from 'contentful'
import AsyncStorageStore from '../../../platforms/javascript/react-native/src/storage/AsyncStorageStore'
import { ENV_CONFIG } from '../env.config'

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
        const response = await client.getEntries({
          'sys.id': entryId,
          include: INCLUDE_DEPTH,
        })

        const { items } = response
        if (items.length > 0) {
          const [entry] = items

          // Attach includes to the entry if they exist
          if (response.includes?.Entry) {
            const entryWithIncludes: Entry & { includes?: { Entry?: Entry[] } } = {
              ...entry,
              includes: { Entry: response.includes.Entry },
            }
            fetchedEntries.push(entryWithIncludes)
            logger.debug(`Fetched entry ${entryId} with ${response.includes.Entry.length} includes`)
          } else {
            fetchedEntries.push(entry)
          }
        }
      } catch (_error: unknown) {
        logger.warn(`Entry "${entryId}" could not be found in the current space`)
      }
    }

    setEntries(fetchedEntries)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorText = `Failed to fetch entries: ${errorMessage}`
    logger.error(errorText)
    setSdkError(errorText)
  }
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
