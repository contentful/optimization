import type Optimization from '@contentful/optimization-react-native'
import type {
  AudienceDefinition,
  ContentfulEntry,
  ExperienceDefinition,
  VariantDistribution,
} from '@contentful/optimization-react-native-preview-panel'
import { createClient, type Entry } from 'contentful'
import AsyncStorageStore from '../../src/storage/AsyncStorageStore'
import { ENV_CONFIG } from '../env.config'
import type { SDKInfo } from '../types'

interface AudienceEntryFields {
  nt_audience_id?: string
  nt_name?: string
  nt_description?: string
}

interface ExperienceEntryFields {
  nt_experience_id?: string
  nt_name?: string
  nt_type?: 'nt_personalization' | 'nt_experiment'
  nt_config?: {
    distribution?: number[]
    components?: Array<{
      baseline?: { id: string }
      variants?: Array<{ id: string; hidden?: boolean }>
    }>
  } | null
  nt_audience?: { sys: { id: string } } | null
}

function hasAudienceFields(fields: unknown): fields is AudienceEntryFields {
  return typeof fields === 'object' && fields !== null
}

function hasExperienceFields(fields: unknown): fields is ExperienceEntryFields {
  return typeof fields === 'object' && fields !== null
}

function getVariantRefForIndex(
  index: number,
  config: NonNullable<ExperienceEntryFields['nt_config']>,
): string {
  const firstComponent = config.components?.[0]
  if (index === 0) {
    return firstComponent?.baseline?.id ?? ''
  }
  return firstComponent?.variants?.[index - 1]?.id ?? ''
}

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
      personalization: { baseUrl: experienceBaseUrl },
      analytics: { baseUrl: insightsBaseUrl },
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

export async function fetchEntriesByContentType(contentTypeId: string): Promise<Entry[]> {
  const {
    contentful: { spaceId, environment, accessToken, host, basePath },
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
    content_type: contentTypeId,
    include: 10,
  })

  return response.items
}

/**
 * Creates AudienceDefinition array from Contentful nt_audience entries.
 * Used to demonstrate how to provide definitions to PreviewPanel.
 */
export function createAudienceDefinitionsFromEntries(
  entries: ContentfulEntry[],
): AudienceDefinition[] {
  return entries.map((entry) => {
    const fields: unknown = entry.fields
    if (hasAudienceFields(fields)) {
      return {
        id: fields.nt_audience_id ?? entry.sys.id,
        name: fields.nt_name ?? fields.nt_audience_id ?? entry.sys.id,
        description: fields.nt_description,
      }
    }
    return {
      id: entry.sys.id,
      name: entry.sys.id,
    }
  })
}

/**
 * Creates ExperienceDefinition array from Contentful nt_experience entries.
 * Used to demonstrate how to provide definitions to PreviewPanel.
 */
export function createExperienceDefinitionsFromEntries(
  entries: ContentfulEntry[],
): ExperienceDefinition[] {
  return entries.map((entry) => {
    const fields: unknown = entry.fields
    if (!hasExperienceFields(fields)) {
      return {
        id: entry.sys.id,
        name: entry.sys.id,
        type: 'nt_personalization' as const,
        distribution: [],
      }
    }

    const { nt_config: config } = fields
    const distribution: VariantDistribution[] = []

    if (config?.distribution) {
      config.distribution.forEach((percentage, index) => {
        distribution.push({
          index,
          variantRef: getVariantRefForIndex(index, config),
          percentage: Math.round(percentage * 100),
        })
      })
    }

    return {
      id: fields.nt_experience_id ?? entry.sys.id,
      name: fields.nt_name ?? entry.sys.id,
      type: fields.nt_type ?? 'nt_personalization',
      distribution,
      audience: fields.nt_audience ? { id: fields.nt_audience.sys.id } : undefined,
    }
  })
}
