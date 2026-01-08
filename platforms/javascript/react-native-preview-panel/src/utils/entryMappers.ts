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
 * Extracts the audience ID from an entry, checking both nt_audience_id field and sys.id
 */
function getAudienceId(entry: ContentfulEntry): string {
  const fields: unknown = entry.fields
  if (hasAudienceFields(fields)) {
    return fields.nt_audience_id ?? entry.sys.id
  }
  return entry.sys.id
}

/**
 * Extracts the experience ID from an entry, checking both nt_experience_id field and sys.id
 */
function getExperienceId(entry: ContentfulEntry): string {
  const fields: unknown = entry.fields
  if (hasExperienceFields(fields)) {
    return fields.nt_experience_id ?? entry.sys.id
  }
  return entry.sys.id
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
 * Enriches audience definitions with names from Contentful entries.
 * Maps entries by nt_audience_id or sys.id to find matching definitions.
 *
 * @param definitions - Original audience definitions from optimization API
 * @param entries - Contentful entries of type nt_audience
 * @returns Enriched audience definitions with names from entries
 */
export function enrichAudienceDefinitions(
  definitions: AudienceDefinition[],
  entries: ContentfulEntry[],
): AudienceDefinition[] {
  if (entries.length === 0) {
    return definitions
  }

  const entryMap = new Map<string, ContentfulEntry>()
  entries.forEach((entry) => {
    const audienceId = getAudienceId(entry)
    entryMap.set(audienceId, entry)
  })

  return definitions.map((definition) => {
    const entry = entryMap.get(definition.id)
    if (!entry) {
      return definition
    }

    const fields: unknown = entry.fields
    if (hasAudienceFields(fields)) {
      return {
        ...definition,
        name: fields.nt_name ?? definition.name,
        description: fields.nt_description ?? definition.description,
      }
    }
    return definition
  })
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
 * Enriches experience definitions with names from Contentful entries.
 * Maps entries by nt_experience_id or sys.id to find matching definitions.
 * Also enriches variant distributions with names from linked variant entries.
 *
 * @param definitions - Original experience definitions from optimization API
 * @param entries - Contentful entries of type nt_experience
 * @returns Enriched experience definitions with names from entries
 */
export function enrichExperienceDefinitions(
  definitions: ExperienceDefinition[],
  entries: ContentfulEntry[],
): ExperienceDefinition[] {
  if (entries.length === 0) {
    return definitions
  }

  const entryMap = new Map<string, ContentfulEntry>()
  entries.forEach((entry) => {
    const experienceId = getExperienceId(entry)
    entryMap.set(experienceId, entry)
  })

  const variantEntryMap = buildVariantEntryMap(entries)

  return definitions.map((definition) => {
    const entry = entryMap.get(definition.id)
    if (!entry) {
      return definition
    }

    const fields: unknown = entry.fields

    const enrichedDistribution: VariantDistribution[] = definition.distribution.map((variant) => {
      const variantEntry = variantEntryMap.get(variant.variantRef)
      if (!variantEntry) {
        return variant
      }

      return {
        ...variant,
        name: getVariantName(variantEntry),
      }
    })

    if (hasExperienceFields(fields)) {
      return {
        ...definition,
        name: fields.nt_name ?? definition.name,
        distribution: enrichedDistribution,
      }
    }
    return {
      ...definition,
      distribution: enrichedDistribution,
    }
  })
}
