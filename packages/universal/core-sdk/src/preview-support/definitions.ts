import type { OptimizationType } from '@contentful/optimization-api-client/api-schemas'

/**
 * Audience definition from the optimization platform.
 *
 * @public
 */
export interface AudienceDefinition {
  /** Unique audience identifier */
  id: string
  /** Human-readable audience name */
  name: string
  /** Optional description of audience targeting criteria */
  description?: string
}

/**
 * Variant distribution configuration for an experience.
 *
 * @public
 */
export interface VariantDistribution {
  /** Variant index (0 = baseline) */
  index: number
  /** Reference to the variant content */
  variantRef: string
  /** Optional traffic percentage (0-100) */
  percentage?: number
  /** Optional human-readable name from Contentful entry */
  name?: string
}

/**
 * Experience definition representing a personalization or experiment configuration.
 *
 * @public
 */
export interface ExperienceDefinition {
  /** Unique experience identifier */
  id: string
  /** Human-readable experience name */
  name: string
  /** Type of experience */
  type: OptimizationType
  /** Variant distribution configuration */
  distribution: VariantDistribution[]
  /** Associated audience (if audience-targeted) */
  audience?: { id: string }
}

/**
 * Three-state override value for audiences: `'on'` forces active, `'off'` forces
 * inactive, `'default'` defers to the SDK evaluation.
 *
 * @public
 */
export type AudienceOverrideState = 'on' | 'off' | 'default'

/**
 * Experience definition enriched with the SDK-derived selection state that
 * the preview panel needs to render variant chips and override indicators.
 *
 * @public
 */
export interface ExperienceWithState extends ExperienceDefinition {
  /** Current variant selected by the SDK (with any active overrides applied). */
  currentVariantIndex: number
  /** True when an active variant override exists for this experience. */
  isOverridden: boolean
  /** The natural pre-override variant index, set only when `isOverridden` is true. */
  naturalVariantIndex?: number
}

/**
 * Combined audience data with associated experiences, used for audience-grouped display.
 *
 * @public
 */
export interface AudienceWithExperiences {
  /** Audience definition */
  audience: AudienceDefinition
  /** Experiences targeting this audience, enriched with current selection state. */
  experiences: ExperienceWithState[]
  /** Whether user naturally qualifies for this audience (from API) */
  isQualified: boolean
  /** Whether audience is currently active (considering overrides) */
  isActive: boolean
  /** Current override state */
  overrideState: AudienceOverrideState
}

/**
 * Preview data containing all audience and experience definitions.
 *
 * @public
 */
export interface PreviewData {
  /** All available audience definitions */
  audienceDefinitions: AudienceDefinition[]
  /** All available experience definitions */
  experienceDefinitions: ExperienceDefinition[]
}

/**
 * Simplified Contentful entry structure for mapping entries to preview panel definitions.
 *
 * @public
 */
export interface ContentfulEntry {
  sys: {
    id: string
    contentType?: {
      sys: {
        id: string
      }
    }
  }
  fields: Record<string, unknown>
}

/**
 * Entry collection response from the Contentful client, including pagination metadata.
 *
 * @public
 */
export interface ContentfulEntryCollection {
  items: ContentfulEntry[]
  total: number
  skip: number
  limit: number
}

/**
 * Minimal Contentful client interface required by the preview panel.
 *
 * @public
 */
export interface ContentfulClient {
  getEntries: (query: {
    content_type: string
    include?: number
    skip?: number
    limit?: number
  }) => Promise<ContentfulEntryCollection>
}
