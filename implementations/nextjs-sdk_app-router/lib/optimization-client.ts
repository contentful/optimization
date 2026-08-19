'use client'

import { bindNextjsAppRouterClientOptimization } from '@contentful/optimization-nextjs/app-router/client'
import { appConfig } from './config'
import { getBrowserAppConsent } from './util'

const BEFORE_INITIAL_PAGE_QUERY_VALUE = 'readiness'
const BEFORE_INITIAL_PAGE_MAX_WAIT_MS = 2_500

function getBrowserClientDefaults(): {
  readonly consent: boolean
  readonly persistenceConsent: boolean
} {
  const consent = getBrowserAppConsent() ?? false

  return { consent, persistenceConsent: consent }
}

const optimization = bindNextjsAppRouterClientOptimization({
  clientId: appConfig.clientId,
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
  beforeInitialPage: {
    maxWaitMs: BEFORE_INITIAL_PAGE_MAX_WAIT_MS,
    run: ({ identify }) => {
      const scenario = new URLSearchParams(window.location.search).get('beforeInitialPage')
      if (scenario !== BEFORE_INITIAL_PAGE_QUERY_VALUE) return

      return identify({ userId: 'charles', traits: { identified: true } })
    },
  },
  trackEntryInteraction: { views: true, clicks: true, hovers: true },
})

export const { RequestOptimizationRoot: ClientRequestOptimizationRoot } = optimization
