import type { Entry } from 'contentful'
import { useEffect, useState } from 'react'
import { fetchDevEntries } from '../contentful'

export interface UseDevEntriesResult {
  entriesById: Map<string, Entry>
  loading: boolean
  error: string | null
}

export function useDevEntries(): UseDevEntriesResult {
  const [entriesById, setEntriesById] = useState<Map<string, Entry>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load(): Promise<void> {
      setLoading(true)
      setError(null)

      try {
        const loadedEntries = await fetchDevEntries()
        if (active) setEntriesById(loadedEntries)
      } catch (caughtError) {
        if (!active) return
        setError(
          caughtError instanceof Error ? caughtError.message : 'Unknown entries loading error',
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  return { entriesById, loading, error }
}
