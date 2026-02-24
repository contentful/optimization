import { createScopedLogger } from '@contentful/optimization-core'
import { useEffect, useState } from 'react'
import type { ContentfulClient, ContentfulEntry } from '../types'
import { fetchAudienceAndExperienceEntries } from '../utils'

const logger = createScopedLogger('RN:Preview')

interface ContentfulEntriesState {
  audienceEntries: ContentfulEntry[]
  experienceEntries: ContentfulEntry[]
  isLoading: boolean
  error: string | null
}

/**
 * Fetches audience and experience entries from Contentful on mount.
 *
 * @param contentfulClient - The Contentful client to use for fetching
 * @returns Loading state, error state, and the fetched audience/experience entries
 *
 * @internal
 */
export function useContentfulEntries(contentfulClient: ContentfulClient): ContentfulEntriesState {
  const [audienceEntries, setAudienceEntries] = useState<ContentfulEntry[]>([])
  const [experienceEntries, setExperienceEntries] = useState<ContentfulEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchContentfulEntries(): Promise<void> {
      setIsLoading(true)
      setError(null)

      try {
        const { audiences, experiences } = await fetchAudienceAndExperienceEntries(contentfulClient)
        setAudienceEntries(audiences)
        setExperienceEntries(experiences)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        logger.error('Failed to fetch entries:', err)
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    void fetchContentfulEntries()
  }, [contentfulClient])

  return {
    audienceEntries,
    experienceEntries,
    isLoading,
    error,
  }
}
