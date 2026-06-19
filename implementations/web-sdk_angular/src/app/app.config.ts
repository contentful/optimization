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
      clientId: environment.PUBLIC_NINETAILED_CLIENT_ID,
      environment: environment.PUBLIC_NINETAILED_ENVIRONMENT,
      insightsBaseUrl: environment.PUBLIC_INSIGHTS_API_BASE_URL,
      experienceBaseUrl: environment.PUBLIC_EXPERIENCE_API_BASE_URL,
      logLevel: resolveLogLevel(environment.PUBLIC_OPTIMIZATION_LOG_LEVEL),
      locale: 'en-US',
      app: { name: 'ContentfulOptimization SDK - Angular Web Reference', version: '0.0.0' },
      autoTrackEntryInteraction: { views: true, clicks: true, hovers: true },
      contentful: {
        accessToken: environment.PUBLIC_CONTENTFUL_TOKEN,
        environment: environment.PUBLIC_CONTENTFUL_ENVIRONMENT,
        spaceId: environment.PUBLIC_CONTENTFUL_SPACE_ID,
        cdaHost: environment.PUBLIC_CONTENTFUL_CDA_HOST,
        basePath: environment.PUBLIC_CONTENTFUL_BASE_PATH,
      },
      ...(environment.PUBLIC_OPTIMIZATION_ENABLE_PREVIEW_PANEL === 'true'
        ? { previewPanel: {} }
        : {}),
    }),
  ],
}
