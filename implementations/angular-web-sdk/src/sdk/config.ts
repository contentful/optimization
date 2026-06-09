import { inject, InjectionToken, type FactoryProvider } from '@angular/core'

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
    tag?: string
    toggleSelector?: string
  }
}

export const NG_CONTENTFUL_OPTIMIZATION_CONFIG = new InjectionToken<NgContentfulOptimizationConfig>(
  'NG_CONTENTFUL_OPTIMIZATION_CONFIG',
)

export function provideContentfulOptimizationConfig<T>(
  token: InjectionToken<T>,
  mapFn: (config: T) => NgContentfulOptimizationConfig,
): FactoryProvider {
  return {
    provide: NG_CONTENTFUL_OPTIMIZATION_CONFIG,
    useFactory: () => mapFn(inject(token)),
  }
}
