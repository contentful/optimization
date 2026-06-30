import { createScopedLogger } from '@contentful/optimization-core/logger'
import { useEffect, useState } from 'react'
import type { ContentfulClient, ContentfulEntryCollection } from '../types'
import { fetchAudienceAndExperienceEntries } from '../utils'

const logger = createScopedLogger('RN:Preview')

interface ContentfulEntriesState {
  audienceEntries: ContentfulEntryCollection
  experienceEntries: ContentfulEntryCollection
  isLoading: boolean
  error: string | null
}

const EMPTY_ENTRY_COLLECTION: ContentfulEntryCollection = {
  items: [],
  limit: 0,
  skip: 0,
  total: 0,
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
  const [audienceEntries, setAudienceEntries] =
    useState<ContentfulEntryCollection>(EMPTY_ENTRY_COLLECTION)
  const [experienceEntries, setExperienceEntries] =
    useState<ContentfulEntryCollection>(EMPTY_ENTRY_COLLECTION)
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
