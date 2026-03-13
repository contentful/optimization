import type ContentfulOptimization from '@contentful/optimization-web'

export type ContentfulOptimizationOrNull = ContentfulOptimization | null

export interface PersonalizationEntryInput {
  id?: string
  [key: string]: unknown
}

export interface AnalyticsEventInput {
  event: string
  properties?: Record<string, unknown>
}
