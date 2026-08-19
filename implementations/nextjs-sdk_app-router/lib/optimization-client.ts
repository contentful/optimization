'use client'

import { bindNextjsAppRouterClientOptimization } from '@contentful/optimization-nextjs/app-router/client'
import { appConfig } from './config'
import { getBrowserAppConsent } from './util'

const INITIAL_EXPERIENCE_QUERY_VALUE = 'readiness'
const INITIAL_EXPERIENCE_MAX_WAIT_MS = 2_500

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
  initialExperience: {
    maxWaitMs: INITIAL_EXPERIENCE_MAX_WAIT_MS,
    run: ({ identify }) => {
      const scenario = new URLSearchParams(window.location.search).get('initialExperience')
      if (scenario !== INITIAL_EXPERIENCE_QUERY_VALUE) return

      return identify({ userId: 'charles', traits: { identified: true } })
    },
  },
  trackEntryInteraction: { views: true, clicks: true, hovers: true },
})

export const { RequestOptimizationRoot: ClientRequestOptimizationRoot } = optimization
