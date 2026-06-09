import {
  type ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core'
import { provideRouter } from '@angular/router'
import { provideContentfulOptimizationConfig } from '@contentful/optimization-angular'
import { routes } from './app.routes'

const { env } = import.meta
const {
  PUBLIC_NINETAILED_CLIENT_ID,
  PUBLIC_NINETAILED_ENVIRONMENT,
  PUBLIC_INSIGHTS_API_BASE_URL,
  PUBLIC_EXPERIENCE_API_BASE_URL,
  PUBLIC_OPTIMIZATION_LOG_LEVEL,
  PUBLIC_CONTENTFUL_TOKEN,
  PUBLIC_CONTENTFUL_ENVIRONMENT,
  PUBLIC_CONTENTFUL_SPACE_ID,
  PUBLIC_CONTENTFUL_CDA_HOST,
  PUBLIC_CONTENTFUL_BASE_PATH,
  PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL,
} = env

function resolveLogLevel(raw: string | undefined): 'debug' | 'warn' | 'error' {
  if (raw === 'warn' || raw === 'error') return raw
  return 'debug'
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideContentfulOptimizationConfig({
      clientId: PUBLIC_NINETAILED_CLIENT_ID ?? 'mock-client-id',
      environment: PUBLIC_NINETAILED_ENVIRONMENT ?? 'main',
      insightsBaseUrl: PUBLIC_INSIGHTS_API_BASE_URL ?? 'http://localhost:8000/insights/',
      experienceBaseUrl: PUBLIC_EXPERIENCE_API_BASE_URL ?? 'http://localhost:8000/experience/',
      logLevel: resolveLogLevel(PUBLIC_OPTIMIZATION_LOG_LEVEL),
      locale: 'en-US',
      contentfulLocales: { default: 'en-US' },
      app: { name: 'ContentfulOptimization SDK - Angular Web Reference', version: '0.0.0' },
      autoTrackEntryInteraction: { views: true, clicks: true, hovers: true },
      contentful: {
        accessToken: PUBLIC_CONTENTFUL_TOKEN ?? 'mock-token',
        environment: PUBLIC_CONTENTFUL_ENVIRONMENT ?? 'master',
        spaceId: PUBLIC_CONTENTFUL_SPACE_ID ?? 'mock-space-id',
        cdaHost: PUBLIC_CONTENTFUL_CDA_HOST ?? 'localhost:8000',
        basePath: PUBLIC_CONTENTFUL_BASE_PATH ?? 'contentful',
      },
      ...(PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL !== 'false' ? { previewPanel: {} } : {}),
    }),
  ],
}
