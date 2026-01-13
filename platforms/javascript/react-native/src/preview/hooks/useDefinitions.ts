import { useMemo } from 'react'
import type { AudienceDefinition, ContentfulEntry, ExperienceDefinition } from '../types'
import { createAudienceDefinitions, createExperienceDefinitions } from '../utils'

interface UseDefinitionsResult {
  audienceDefinitions: AudienceDefinition[]
  experienceDefinitions: ExperienceDefinition[]
  audienceNames: Record<string, string>
  experienceNames: Record<string, string>
}

/**
 * Hook to create definitions and name maps from Contentful entries.
 * Memoizes the computed values for performance.
 */
export function useDefinitions(
  audienceEntries: ContentfulEntry[],
  experienceEntries: ContentfulEntry[],
): UseDefinitionsResult {
  const audienceDefinitions = useMemo(
    () => createAudienceDefinitions(audienceEntries),
    [audienceEntries],
  )

  const experienceDefinitions = useMemo(
    () => createExperienceDefinitions(experienceEntries),
    [experienceEntries],
  )

  const audienceNames = useMemo(
    () =>
      audienceDefinitions.reduce<Record<string, string>>((acc, audience) => {
        const { id, name } = audience
        acc[id] = name
        return acc
      }, {}),
    [audienceDefinitions],
  )

  const experienceNames = useMemo(
    () =>
      experienceDefinitions.reduce<Record<string, string>>((acc, experience) => {
        const { id, name } = experience
        acc[id] = name
        return acc
      }, {}),
    [experienceDefinitions],
  )

  return {
    audienceDefinitions,
    experienceDefinitions,
    audienceNames,
    experienceNames,
  }
}
