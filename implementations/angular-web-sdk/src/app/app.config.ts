import {
  type ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core'
import { provideRouter } from '@angular/router'
import { OPTIMIZATION_CONFIG } from '@contentful/optimization-angular'
import { routes } from './app.routes'
import { CONFIG } from './config/config.token'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    {
      provide: OPTIMIZATION_CONFIG,
      useFactory: () => {
        const c = inject(CONFIG)
        return {
          clientId: c.clientId,
          environment: c.sdkEnvironment,
          insightsBaseUrl: c.insightsBaseUrl,
          experienceBaseUrl: c.experienceBaseUrl,
          logLevel: c.logLevel,
          locale: 'en-US',
          contentfulLocales: { default: 'en-US' },
          app: { name: 'ContentfulOptimization SDK - Angular Web Reference', version: '0.0.0' },
          autoTrackEntryInteraction: { views: true, clicks: true, hovers: true },
          ...(c.enablePreviewPanel
            ? {
                previewPanel: {
                  contentfulToken: c.contentfulToken,
                  contentfulEnvironment: c.contentfulEnvironment,
                  contentfulSpaceId: c.contentfulSpaceId,
                  contentfulCdaHost: c.contentfulCdaHost,
                  contentfulBasePath: c.contentfulBasePath,
                },
              }
            : {}),
        }
      },
    },
  ],
}
