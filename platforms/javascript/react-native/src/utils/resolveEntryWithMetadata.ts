import {
  isPersonalizedEntry,
  type SelectedPersonalizationArray,
} from '@contentful/optimization-api-client'
import { signals } from '@contentful/optimization-core'
import type { Entry } from 'contentful'
import type Optimization from '../index'

/**
 * Result of resolving a Contentful entry with tracking metadata.
 */
export interface EntryResolutionResult {
  /**
   * The entry to display - either the baseline entry or a resolved variant entry
   */
  entry: Entry

  /**
   * The component ID for tracking (entry sys.id)
   */
  componentId: string

  /**
   * The experience/personalization ID if this entry is personalized,
   * undefined for non-personalized entries
   */
  experienceId?: string

  /**
   * The variant index:
   * - 0 for baseline/non-personalized content
   * - 1+ for personalized variants
   */
  variantIndex: number
}

/**
 * Resolves a baseline Contentful entry to its display variant and extracts tracking metadata.
 *
 * @param baselineEntry - The baseline Contentful entry fetched with { include: 10 }
 * @param optimization - The Optimization SDK instance
 * @returns EntryResolutionResult with both display entry and tracking metadata
 *
 * @example
 * ```typescript
 * const baselineEntry = await contentful.getEntry('hero-id', { include: 10 })
 * const { entry, componentId, experienceId, variantIndex } =
 *   resolveEntryWithMetadata(baselineEntry, optimization)
 *
 * // Use entry for rendering
 * <HeroComponent data={entry.fields} />
 *
 * // Use tracking metadata for analytics
 * await optimization.analytics.trackComponentView({
 *   componentId,
 *   experienceId,
 *   variantIndex
 * })
 * ```
 */
/**
 * Extracts tracking metadata from a personalized entry
 */
function getTrackingMetadata(
  baselineEntry: Entry,
  personalizedEntryResolver: Optimization['personalization']['personalizedEntryResolver'],
  personalizations: SelectedPersonalizationArray,
): { experienceId?: string; variantIndex: number } {
  if (!isPersonalizedEntry(baselineEntry)) {
    return { experienceId: undefined, variantIndex: 0 }
  }

  const personalizationEntry = personalizedEntryResolver.getPersonalizationEntry(
    { personalizedEntry: baselineEntry, personalizations },
    true,
  )

  if (!personalizationEntry) {
    return { experienceId: undefined, variantIndex: 0 }
  }

  const { sys } = personalizationEntry
  const variantIndex = personalizedEntryResolver.getSelectedVariantIndex(
    { personalizationEntry, personalizations },
    true,
  )

  return { experienceId: sys.id, variantIndex }
}

export function resolveEntryWithMetadata(
  baselineEntry: Entry,
  optimization: Optimization,
): EntryResolutionResult {
  const {
    sys: { id: componentId },
  } = baselineEntry
  const { personalization } = optimization
  const { personalizedEntryResolver } = personalization
  const personalizations: SelectedPersonalizationArray | undefined = signals.personalizations.value

  // Use the existing resolve() method to get the resolved entry
  const resolvedEntry = personalizedEntryResolver.resolve(baselineEntry, personalizations)

  // Extract tracking metadata
  const { experienceId, variantIndex } = personalizations?.length
    ? getTrackingMetadata(baselineEntry, personalizedEntryResolver, personalizations)
    : { experienceId: undefined, variantIndex: 0 }

  return {
    entry: resolvedEntry,
    componentId,
    experienceId,
    variantIndex,
  }
}
