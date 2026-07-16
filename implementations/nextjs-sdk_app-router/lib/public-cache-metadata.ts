import type { SelectedOptimizationArray } from '@contentful/optimization-nextjs/api-schemas'

export interface PublicSegmentCacheMetadata {
  readonly key: string
  readonly scope: 'public-permutation'
  readonly tags: readonly [string]
}

export function createPublicSegmentCacheMetadata(input: {
  readonly baselineEntryIds: readonly string[]
  readonly cacheVersion: string
  readonly createOptimizationCacheKey: (cacheInput: {
    readonly entryIds?: readonly string[]
    readonly locale?: string
    readonly scope: 'public-permutation'
    readonly selectedOptimizations?: SelectedOptimizationArray
  }) => string
  readonly locale: string
  readonly selectedOptimizations: SelectedOptimizationArray
  readonly slug: string
}): PublicSegmentCacheMetadata {
  const key = [
    `segment:${input.slug}`,
    `v${input.cacheVersion}`,
    input.createOptimizationCacheKey({
      scope: 'public-permutation',
      locale: input.locale,
      entryIds: input.baselineEntryIds,
      selectedOptimizations: input.selectedOptimizations,
    }),
  ].join(':')

  return {
    key,
    scope: 'public-permutation',
    tags: [key],
  }
}
