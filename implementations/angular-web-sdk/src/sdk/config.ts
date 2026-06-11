import { InjectionToken, type ValueProvider } from '@angular/core'
import { type ContentfulClientApi, createClient } from 'contentful'

export interface NgContentfulOptimizationConfig {
  clientId: string
  environment: string
  insightsBaseUrl: string
  experienceBaseUrl: string
  logLevel?: 'debug' | 'warn' | 'error'
  locale: string
  contentfulLocales: { default: string }
  app: { name: string; version: string }
  autoTrackEntryInteraction?: { views?: boolean; clicks?: boolean; hovers?: boolean }
  contentful: {
    accessToken: string
    environment: string
    spaceId: string
    cdaHost: string
    basePath: string
  }
  previewPanel?: {
    nonce?: string
  }
}

export const NG_CONTENTFUL_OPTIMIZATION_CONFIG = new InjectionToken<NgContentfulOptimizationConfig>(
  'NG_CONTENTFUL_OPTIMIZATION_CONFIG',
)

export function provideContentfulOptimizationConfig(
  config: NgContentfulOptimizationConfig,
): ValueProvider {
  return { provide: NG_CONTENTFUL_OPTIMIZATION_CONFIG, useValue: config }
}

// Shared base client singleton — one CDA connection for both NgContentfulClient and the preview
// panel attachment. The Contentful client is stateless so it is never torn down.
let baseClient: ContentfulClientApi<undefined> | undefined = undefined

export function getOrCreateBaseClient(
  config: NgContentfulOptimizationConfig,
): ContentfulClientApi<undefined> {
  baseClient ??= createClient({
    accessToken: config.contentful.accessToken,
    environment: config.contentful.environment,
    space: config.contentful.spaceId,
    host: config.contentful.cdaHost,
    insecure: config.contentful.cdaHost.includes('localhost'),
    basePath: config.contentful.basePath,
  })
  return baseClient
}
