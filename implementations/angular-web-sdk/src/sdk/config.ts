import { InjectionToken } from '@angular/core'

export interface OptimizationConfig {
  clientId: string
  environment: string
  insightsBaseUrl: string
  experienceBaseUrl: string
  logLevel?: 'debug' | 'warn' | 'error'
  locale: string
  contentfulLocales: { default: string }
  app: { name: string; version: string }
  autoTrackEntryInteraction?: { views?: boolean; clicks?: boolean; hovers?: boolean }
  previewPanel?: {
    contentfulToken: string
    contentfulEnvironment: string
    contentfulSpaceId: string
    contentfulCdaHost: string
    contentfulBasePath: string
    nonce?: string
  }
}

export const OPTIMIZATION_CONFIG = new InjectionToken<OptimizationConfig>('OPTIMIZATION_CONFIG')
