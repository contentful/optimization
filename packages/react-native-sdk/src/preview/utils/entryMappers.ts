import type {
  AudienceDefinition,
  ContentfulEntry,
  ExperienceDefinition,
  VariantDistribution,
} from '../types'

/** @internal */
interface AudienceEntryFields {
  nt_audience_id?: string
  nt_name?: string
  nt_description?: string
}

/** @internal */
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

/** @internal */
interface OptimizationEntryFields {
  nt_personalization_id?: string
  nt_experience_id?: string
  nt_name?: string
}

/** @internal */
interface VariantEntryFields {
  internalTitle?: string
  title?: string
  name?: string
}

/** @internal */
function hasAudienceFields(fields: unknown): fields is AudienceEntryFields {
  return typeof fields === 'object' && fields !== null
}

/** @internal */
function hasExperienceFields(fields: unknown): fields is ExperienceEntryFields {
  return typeof fields === 'object' && fields !== null
}

/** @internal */
function hasVariantFields(fields: unknown): fields is VariantEntryFields {
  return typeof fields === 'object' && fields !== null
}

/** @internal */
function hasOptimizationFields(fields: unknown): fields is OptimizationEntryFields {
  return typeof fields === 'object' && fields !== null
}

/** @internal */
function getVariantName(entry: ContentfulEntry): string | undefined {
  const fields: unknown = entry.fields
  if (hasVariantFields(fields)) {
    return fields.internalTitle ?? fields.title ?? fields.name
  }
  return undefined
}

/** @internal */
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

/** @internal */
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
 * Creates {@link AudienceDefinition} instances from Contentful `nt_audience` entries.
 *
 * @param entries - Contentful entries of type `nt_audience`
 * @returns Array of audience definitions
 *
 * @public
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
 * Creates {@link ExperienceDefinition} instances from Contentful `nt_experience` entries,
 * including variant distribution with names extracted from linked entries.
 *
 * @param entries - Contentful entries of type `nt_experience`
 * @returns Array of experience definitions with full variant information
 *
 * @public
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
 *
 * @param entries - Contentful entries of type `nt_personalization`
 * @returns Record mapping experience IDs to display names
 *
 * @public
 */
export function createExperienceNameMap(entries: ContentfulEntry[]): Record<string, string> {
  const nameMap: Record<string, string> = {}

  entries.forEach((entry) => {
    const fields: unknown = entry.fields
    if (hasOptimizationFields(fields)) {
      const id = fields.nt_personalization_id ?? fields.nt_experience_id ?? entry.sys.id

      const { nt_name: name } = fields
      if (name) {
        nameMap[id] = name
      }
    }
  })

  return nameMap
}
