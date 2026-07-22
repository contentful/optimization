import type { Entry } from 'contentful'
import { useEffect, useState } from 'react'
import type { OptimizationSdk } from '../context/OptimizationContext'

/**
 * Hackathon-only cf-entities variant hydration.
 *
 * When XP's `selectedOptimization.variants` maps a baseline to a variant entry
 * whose ID differs from the sync resolver's chosen entry, the variant is not
 * reachable through the customer's CDA graph (no `nt_experiences → nt_variants`
 * walk exists). Fetch it directly via the SDK-managed Contentful client so
 * `OptimizedEntry` can render the variant content in place of the baseline.
 *
 * Full context: specs/adhoc-cf-entities-migration/coin-demo-spec.md § Change B.
 */
export function useCfEntitiesVariantFetch(
  sdk: OptimizationSdk | undefined,
  baselineEntry: Entry,
  resolvedEntry: Entry,
  mappedVariantId: string | undefined,
): Entry | undefined {
  const needsFetch =
    sdk !== undefined &&
    typeof mappedVariantId === 'string' &&
    mappedVariantId !== '' &&
    mappedVariantId !== resolvedEntry.sys.id &&
    resolvedEntry.sys.id === baselineEntry.sys.id
  const fetchKey = needsFetch ? mappedVariantId : undefined
  const [fetched, setFetched] = useState<Entry | undefined>(undefined)

  useEffect(() => {
    if (!sdk || fetchKey === undefined) {
      setFetched(undefined)
      return
    }

    if (fetched?.sys.id === fetchKey) {
      return
    }

    let cancelled = false
    void sdk.fetchContentfulEntry(fetchKey, { include: 10 }).then(
      (entry: Entry) => {
        if (cancelled) return
        setFetched(entry)
      },
      (_error: unknown) => {
        if (cancelled) return
        setFetched(undefined)
      },
    )

    return () => {
      cancelled = true
    }
  }, [fetchKey, fetched, sdk])

  if (fetchKey === undefined) return undefined
  if (fetched?.sys.id !== fetchKey) return undefined
  return fetched
}
