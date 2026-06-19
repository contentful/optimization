import {
  type ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core'
import { provideRouter } from '@angular/router'
import { environment } from '../environments/environment'
import { routes } from './app.routes'
import { provideContentfulOptimizationConfig, resolveLogLevel } from './config'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideContentfulOptimizationConfig({
      clientId: environment.PUBLIC_NINETAILED_CLIENT_ID || 'mock-client-id',
      environment: environment.PUBLIC_NINETAILED_ENVIRONMENT || 'main',
      insightsBaseUrl:
        environment.PUBLIC_INSIGHTS_API_BASE_URL || 'http://localhost:8000/insights/',
      experienceBaseUrl:
        environment.PUBLIC_EXPERIENCE_API_BASE_URL || 'http://localhost:8000/experience/',
      logLevel: resolveLogLevel(environment.PUBLIC_OPTIMIZATION_LOG_LEVEL),
      locale: 'en-US',
      app: { name: 'ContentfulOptimization SDK - Angular Web Reference', version: '0.0.0' },
      autoTrackEntryInteraction: { views: true, clicks: true, hovers: true },
      contentful: {
        accessToken: environment.PUBLIC_CONTENTFUL_TOKEN || 'mock-token',
        environment: environment.PUBLIC_CONTENTFUL_ENVIRONMENT || 'master',
        spaceId: environment.PUBLIC_CONTENTFUL_SPACE_ID || 'mock-space-id',
        cdaHost: environment.PUBLIC_CONTENTFUL_CDA_HOST || 'localhost:8000',
        basePath: environment.PUBLIC_CONTENTFUL_BASE_PATH || 'contentful',
      },
      ...(environment.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL === 'true'
        ? { previewPanel: {} }
        : {}),
    }),
  ],
}
