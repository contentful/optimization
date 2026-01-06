import { useMemo } from 'react'
import {
  ALL_VISITORS_AUDIENCE_DESCRIPTION,
  ALL_VISITORS_AUDIENCE_ID,
  ALL_VISITORS_AUDIENCE_NAME,
} from '../constants'
import type {
  AudienceDefinition,
  AudienceOverrideState,
  AudienceWithExperiences,
  ExperienceDefinition,
  OverrideState,
  PreviewState,
} from '../types'

interface UsePreviewDataParams {
  /** Audience definitions from configuration/CMS */
  audienceDefinitions: AudienceDefinition[]
  /** Experience definitions from configuration/CMS */
  experienceDefinitions: ExperienceDefinition[]
  /** Current preview state from SDK */
  previewState: PreviewState
  /** Current override state */
  overrides: OverrideState
}

interface UsePreviewDataResult {
  /** Audiences with their associated experiences and computed states */
  audiencesWithExperiences: AudienceWithExperiences[]
  /** Experiences that don't have an associated audience (global experiences) */
  unassociatedExperiences: ExperienceDefinition[]
  /** Whether any data is available */
  hasData: boolean
}

/**
 * Hook that combines audience and experience definitions with SDK state
 * to produce a unified view of all optimization data.
 *
 * This enables displaying human-readable names and grouping experiences
 * by their target audience.
 *
 * Experiences without a specific audience are grouped under an
 * "All Visitors" fallback audience.
 */
export const usePreviewData = ({
  audienceDefinitions,
  experienceDefinitions,
  previewState,
  overrides,
}: UsePreviewDataParams): UsePreviewDataResult => {
  const { profile } = previewState

  // Get the set of audience IDs that the user qualifies for from the API
  const qualifiedAudienceIds = useMemo(
    () => new Set(profile?.audiences ?? []),
    [profile?.audiences],
  )

  // Find experiences without an associated audience (global experiences)
  const unassociatedExperiences = useMemo(() => {
    const audienceIds = new Set(audienceDefinitions.map((a) => a.id))
    return experienceDefinitions.filter((exp) => {
      // Include if no audience specified
      if (!exp.audience?.id) return true
      // Include if the audience doesn't exist in definitions
      return !audienceIds.has(exp.audience.id)
    })
  }, [audienceDefinitions, experienceDefinitions])

  // Compute audiences with their experiences
  const audiencesWithExperiences = useMemo(() => {
    const result: AudienceWithExperiences[] = []

    // Process defined audiences
    audienceDefinitions.forEach((audience) => {
      // Find experiences targeting this audience
      const experiences = experienceDefinitions.filter((exp) => exp.audience?.id === audience.id)

      // Check if user naturally qualifies for this audience
      const isQualified = qualifiedAudienceIds.has(audience.id)

      // Determine override state
      // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- dynamic key access
      const audienceOverride = overrides.audiences[audience.id]
      let overrideState: AudienceOverrideState = 'default'
      if (audienceOverride) {
        overrideState = audienceOverride.isActive ? 'on' : 'off'
      }

      // Compute if audience is currently active (considering overrides)
      let isActive = isQualified
      if (overrideState === 'on') {
        isActive = true
      } else if (overrideState === 'off') {
        isActive = false
      }

      result.push({
        audience,
        experiences,
        isQualified,
        isActive,
        overrideState,
      })
    })

    // Add "All Visitors" fallback audience if there are unassociated experiences
    if (unassociatedExperiences.length > 0) {
      const allVisitorsAudience: AudienceDefinition = {
        id: ALL_VISITORS_AUDIENCE_ID,
        name: ALL_VISITORS_AUDIENCE_NAME,
        description: ALL_VISITORS_AUDIENCE_DESCRIPTION,
      }

      // Check for override on the fallback audience
      // eslint-disable-next-line @typescript-eslint/prefer-destructuring -- constant key access
      const allVisitorsOverride = overrides.audiences[ALL_VISITORS_AUDIENCE_ID]
      let overrideState: AudienceOverrideState = 'default'
      if (allVisitorsOverride) {
        overrideState = allVisitorsOverride.isActive ? 'on' : 'off'
      }

      // All Visitors is always qualified and active by default
      let isActive = true
      if (overrideState === 'off') {
        isActive = false
      }

      result.push({
        audience: allVisitorsAudience,
        experiences: unassociatedExperiences,
        isQualified: true, // All users qualify for All Visitors
        isActive,
        overrideState,
      })
    }

    return result
  }, [
    audienceDefinitions,
    experienceDefinitions,
    qualifiedAudienceIds,
    overrides.audiences,
    unassociatedExperiences,
  ])

  const hasData = audienceDefinitions.length > 0 || experienceDefinitions.length > 0

  return {
    audiencesWithExperiences,
    unassociatedExperiences,
    hasData,
  }
}

export default usePreviewData
