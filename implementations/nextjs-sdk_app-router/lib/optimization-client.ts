'use client'

import { bindNextjsAppRouterClientOptimization } from '@contentful/optimization-nextjs/app-router/client'
import { appConfig } from './config'
import { getBrowserAppConsent } from './util'

function getBrowserClientDefaults(): {
  readonly consent: boolean
  readonly persistenceConsent: boolean
} {
  const consent = getBrowserAppConsent() ?? false

  return { consent, persistenceConsent: consent }
}

const optimization = bindNextjsAppRouterClientOptimization({
  spaceId: appConfig.spaceId,
  environment: appConfig.environment,
  locale: appConfig.locale,
  logLevel: 'debug',
  api: appConfig.api,
  app: {
    name: 'Contentful Optimization Next.js SDK App Router',
    version: '0.1.0',
  },
  consent: {
    clientDefaults: getBrowserClientDefaults(),
  },
  trackEntryInteraction: { views: true, clicks: true, hovers: true },
})

export const { RequestOptimizationRoot: ClientRequestOptimizationRoot } = optimization
