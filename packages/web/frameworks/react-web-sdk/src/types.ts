import type Optimization from '@contentful/optimization-web'

export type OptimizationWebSdk = Optimization

export type OptimizationWebSdkOrNull = OptimizationWebSdk | null

export interface PersonalizationEntryInput {
  id?: string
  [key: string]: unknown
}

export interface AnalyticsEventInput {
  event: string
  properties?: Record<string, unknown>
}
