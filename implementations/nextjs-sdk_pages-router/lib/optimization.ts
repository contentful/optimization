import { createNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router'
import { appConfig } from './config'

export const { NextPagesAutoPageTracker, OptimizationRoot, OptimizedEntry } =
  createNextjsPagesRouterOptimization({
    clientId: appConfig.clientId,
    environment: appConfig.environment,
    locale: appConfig.locale,
    logLevel: 'debug',
    api: appConfig.api,
    trackEntryInteraction: { views: true, clicks: true, hovers: true },
    defaults: { consent: false, persistenceConsent: false },
    app: {
      name: 'Contentful Optimization Next.js SDK Pages Router',
      version: '0.1.0',
    },
  })
