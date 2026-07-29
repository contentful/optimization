import type { SelectedOptimizationArray } from '@contentful/optimization-nextjs/api-schemas'
import { CUSTOMER_SEGMENTS, type CustomerSegmentSlug } from 'e2e-web'

export interface CustomerSegment {
  readonly baselineEntryIds: readonly string[]
  readonly baselineEntryId: string
  readonly cacheVersion: string
  readonly experienceId: string
  readonly label: string
  readonly locale: string
  readonly resolvedEntryText: string
  readonly selectedOptimizations: SelectedOptimizationArray
  readonly slug: CustomerSegmentSlug
  readonly variantEntryId: string
}

export function getCustomerSegment(slug: string): CustomerSegment | undefined {
  if (!Object.prototype.hasOwnProperty.call(CUSTOMER_SEGMENTS, slug)) return undefined

  const segment = CUSTOMER_SEGMENTS[slug as CustomerSegmentSlug]

  return {
    ...segment,
    baselineEntryIds: [...segment.baselineEntryIds],
    selectedOptimizations: segment.selectedOptimizations.map((selection) => ({
      ...selection,
      variants: { ...selection.variants },
    })),
  }
}

export function getCustomerSegmentStaticParams(): Array<{ readonly segment: CustomerSegmentSlug }> {
  return Object.keys(CUSTOMER_SEGMENTS).map((segment) => ({
    segment: segment as CustomerSegmentSlug,
  }))
}
