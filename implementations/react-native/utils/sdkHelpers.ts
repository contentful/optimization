import type Optimization from '@contentful/optimization-react-native'
import { logger } from '@contentful/optimization-react-native'
import { createClient, type Entry } from 'contentful'

const INCLUDE_DEPTH = 10
const MERGE_TAG_ENTRY_ID = '1MwiFl4z7gkwqGYdvCmr8c'

export async function initializeSDK(
  setSdk: (sdk: Optimization) => void,
  setSdkError: (error: string) => void,
): Promise<void> {
  try {
    const { default: OptimizationSDK } = await import('@contentful/optimization-react-native')

    const sdkInstance = await OptimizationSDK.create({
      clientId: 'test-client-id',
      environment: 'main',
      api: {
        personalization: { baseUrl: 'http://localhost/experience/' },
        analytics: { baseUrl: 'http://localhost/insights/' },
      },
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
  try {
    const client = createClient({
      space: 'test-space',
      environment: 'master',
      accessToken: 'test-token',
      host: 'localhost',
      basePath: '/contentful',
      insecure: true,
    })

    const mergeTagEntryData = await client.getEntry(MERGE_TAG_ENTRY_ID, {
      include: INCLUDE_DEPTH,
    })

    setMergeTagEntry(mergeTagEntryData)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorText = `Failed to fetch merge tag entry: ${errorMessage}`
    logger.error(errorText)
    setSdkError(errorText)
  }
}
