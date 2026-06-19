import {
  type ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core'
import { provideRouter } from '@angular/router'
import { routes } from './app.routes'
import { provideContentfulOptimizationConfig, resolveLogLevel } from './config'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideContentfulOptimizationConfig({
      clientId: import.meta.env.PUBLIC_NINETAILED_CLIENT_ID ?? 'mock-client-id',
      environment: import.meta.env.PUBLIC_NINETAILED_ENVIRONMENT ?? 'main',
      insightsBaseUrl:
        import.meta.env.PUBLIC_INSIGHTS_API_BASE_URL ?? 'http://localhost:8000/insights/',
      experienceBaseUrl:
        import.meta.env.PUBLIC_EXPERIENCE_API_BASE_URL ?? 'http://localhost:8000/experience/',
      logLevel: resolveLogLevel(import.meta.env.PUBLIC_OPTIMIZATION_LOG_LEVEL),
      locale: 'en-US',
      app: { name: 'ContentfulOptimization SDK - Angular Web Reference', version: '0.0.0' },
      autoTrackEntryInteraction: { views: true, clicks: true, hovers: true },
      contentful: {
        accessToken: import.meta.env.PUBLIC_CONTENTFUL_TOKEN ?? 'mock-token',
        environment: import.meta.env.PUBLIC_CONTENTFUL_ENVIRONMENT ?? 'master',
        spaceId: import.meta.env.PUBLIC_CONTENTFUL_SPACE_ID ?? 'mock-space-id',
        cdaHost: import.meta.env.PUBLIC_CONTENTFUL_CDA_HOST ?? 'localhost:8000',
        basePath: import.meta.env.PUBLIC_CONTENTFUL_BASE_PATH ?? 'contentful',
      },
      ...(import.meta.env.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL !== 'false'
        ? { previewPanel: {} }
        : {}),
    }),
  ],
}
