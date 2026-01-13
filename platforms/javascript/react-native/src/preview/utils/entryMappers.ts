import type {
  AudienceDefinition,
  ContentfulEntry,
  ExperienceDefinition,
  VariantDistribution,
} from '../types'

/**
 * Fields expected on an nt_audience Contentful entry
 */
interface AudienceEntryFields {
  nt_audience_id?: string
  nt_name?: string
  nt_description?: string
}

/**
 * Fields expected on an nt_experience Contentful entry
 */
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
  nt_variants?: Array<{ sys: { id: string } }>
}

/**
 * Fields expected on an nt_personalization Contentful entry
 */
interface PersonalizationEntryFields {
  nt_personalization_id?: string
  nt_experience_id?: string
  nt_name?: string
}

/**
 * Fields expected on a variant content entry
 */
interface VariantEntryFields {
  internalTitle?: string
  title?: string
  name?: string
}

/**
 * Type guard to check if fields have audience entry fields
 */
function hasAudienceFields(fields: unknown): fields is AudienceEntryFields {
  return typeof fields === 'object' && fields !== null
}

/**
 * Type guard to check if fields have experience entry fields
 */
function hasExperienceFields(fields: unknown): fields is ExperienceEntryFields {
  return typeof fields === 'object' && fields !== null
}

/**
 * Type guard to check if fields have variant entry fields
 */
function hasVariantFields(fields: unknown): fields is VariantEntryFields {
  return typeof fields === 'object' && fields !== null
}

/**
 * Type guard to check if fields have personalization entry fields
 */
function hasPersonalizationFields(fields: unknown): fields is PersonalizationEntryFields {
  return typeof fields === 'object' && fields !== null
}

/**
 * Gets the display name for a variant entry
 */
function getVariantName(entry: ContentfulEntry): string | undefined {
  const fields: unknown = entry.fields
  if (hasVariantFields(fields)) {
    return fields.internalTitle ?? fields.title ?? fields.name
  }
  return undefined
}

/**
 * Gets the variant reference ID for a given index from the experience config.
 */
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

/**
 * Builds a map of variant entry IDs to their entries from experience entries.
 * Extracts linked variant entries from the experience entry includes.
 */
function buildVariantEntryMap(experienceEntries: ContentfulEntry[]): Map<string, ContentfulEntry> {
  const variantMap = new Map<string, ContentfulEntry>()

  experienceEntries.forEach((entry) => {
    const entryWithIncludes = entry as ContentfulEntry & {
      includes?: { Entry?: ContentfulEntry[] }
    }
    const includedEntries = entryWithIncludes.includes?.Entry ?? []

    includedEntries.forEach((includedEntry) => {
      variantMap.set(includedEntry.sys.id, includedEntry)
    })
  })

  return variantMap
}

/**
 * Creates AudienceDefinition array from Contentful nt_audience entries.
 * Converts raw CMS entries into the internal definition format.
 *
 * @param entries - Contentful entries of type nt_audience
 * @returns Array of audience definitions with id, name, and description
 */
export function createAudienceDefinitions(entries: ContentfulEntry[]): AudienceDefinition[] {
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
 * Converts raw CMS entries into the internal definition format, including
 * variant distribution with names extracted from linked entries.
 *
 * @param entries - Contentful entries of type nt_experience
 * @returns Array of experience definitions with full variant information
 */
export function createExperienceDefinitions(entries: ContentfulEntry[]): ExperienceDefinition[] {
  const variantEntryMap = buildVariantEntryMap(entries)

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
        const variantRef = getVariantRefForIndex(index, config)
        const variantEntry = variantEntryMap.get(variantRef)

        distribution.push({
          index,
          variantRef,
          percentage: Math.round(percentage * 100),
          name: variantEntry ? getVariantName(variantEntry) : undefined,
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

/**
 * Creates a lookup map of experience/personalization IDs to their human-readable names.
 * Used to enrich the personalizations section with names from Contentful entries.
 *
 * @param entries - Contentful entries of type nt_personalization
 * @returns Map of experienceId to name
 */
export function createExperienceNameMap(entries: ContentfulEntry[]): Record<string, string> {
  const nameMap: Record<string, string> = {}

  entries.forEach((entry) => {
    const fields: unknown = entry.fields
    if (hasPersonalizationFields(fields)) {
      const id = fields.nt_personalization_id ?? fields.nt_experience_id ?? entry.sys.id

      const { nt_name: name } = fields
      if (name) {
        nameMap[id] = name
      }
    }
  })

  return nameMap
}
