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
 * Creates memoized audience/experience definitions and name lookup maps
 * from raw Contentful entries.
 *
 * @param audienceEntries - Raw Contentful `nt_audience` entries (Contentful content type IDs created by the Optimization platform)
 * @param experienceEntries - Raw Contentful `nt_experience` entries (Contentful content type IDs created by the Optimization platform)
 * @returns Definitions arrays and name maps
 *
 * @internal
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
