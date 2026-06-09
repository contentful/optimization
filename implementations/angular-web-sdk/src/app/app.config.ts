import {
  type ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core'
import { provideRouter } from '@angular/router'
import { provideContentfulOptimizationConfig } from '@contentful/optimization-angular'
import { routes } from './app.routes'
import { CONFIG } from './config/config.token'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideContentfulOptimizationConfig(CONFIG, (c) => ({
      clientId: c.clientId,
      environment: c.sdkEnvironment,
      insightsBaseUrl: c.insightsBaseUrl,
      experienceBaseUrl: c.experienceBaseUrl,
      logLevel: c.logLevel,
      locale: 'en-US',
      contentfulLocales: { default: 'en-US' },
      app: { name: 'ContentfulOptimization SDK - Angular Web Reference', version: '0.0.0' },
      autoTrackEntryInteraction: { views: true, clicks: true, hovers: true },
      contentful: {
        accessToken: c.contentfulToken,
        environment: c.contentfulEnvironment,
        spaceId: c.contentfulSpaceId,
        cdaHost: c.contentfulCdaHost,
        basePath: c.contentfulBasePath,
      },
      ...(c.enablePreviewPanel ? { previewPanel: {} } : {}),
    })),
  ],
}
