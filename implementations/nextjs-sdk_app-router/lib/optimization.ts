import { createNextjsAppRouterOptimization } from '@contentful/optimization-nextjs/app-router'
import { appConfig } from './config'
import { getAppConsent } from './util'

export const { proxy, NextAppAutoPageTracker, OptimizationRoot, OptimizedEntry } =
  createNextjsAppRouterOptimization({
    clientId: appConfig.clientId,
    environment: appConfig.environment,
    locale: appConfig.locale,
    logLevel: 'debug',
    api: appConfig.api,
    trackEntryInteraction: { views: true, clicks: true, hovers: true },
    defaults: { consent: false, persistenceConsent: false },
    server: {
      enabled: true,
      consent: ({ cookies }) =>
        getAppConsent(cookies) ? { events: true, persistence: true } : false,
    },
    app: {
      name: 'Contentful Optimization Next.js SDK App Router',
      version: '0.1.0',
    },
  })
