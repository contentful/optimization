import { bindNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router'
import { appConfig } from './config'
import { getBrowserAppConsent } from './util'

const BEFORE_INITIAL_PAGE_QUERY_VALUE = 'readiness'
const BEFORE_INITIAL_PAGE_MAX_WAIT_MS = 1_500

function getBrowserClientDefaults(): {
  readonly consent: boolean
  readonly persistenceConsent: boolean
} {
  const consent = getBrowserAppConsent() ?? false

  return { consent, persistenceConsent: consent }
}

export const {
  OptimizationAnalyticsRoot,
  OptimizationRoot,
  OptimizedEntry,
  createHandoffFromSelections,
  createPublicPermutationHandoff,
  resolveEntriesForSelections,
} = bindNextjsPagesRouterOptimization({
  clientId: appConfig.clientId,
  environment: appConfig.environment,
  locale: appConfig.locale,
  logLevel: 'debug',
  api: appConfig.api,
  trackEntryInteraction: { views: true, clicks: true, hovers: true },
  consent: {
    clientDefaults: getBrowserClientDefaults(),
  },
  app: {
    name: 'Contentful Optimization Next.js SDK Pages Router',
    version: '0.1.0',
  },
  beforeInitialPage: {
    maxWaitMs: BEFORE_INITIAL_PAGE_MAX_WAIT_MS,
    run: ({ identify }) => {
      const scenario = new URLSearchParams(window.location.search).get('beforeInitialPage')
      if (scenario !== BEFORE_INITIAL_PAGE_QUERY_VALUE) return

      return identify({ userId: 'charles', traits: { identified: true } })
    },
  },
})
export { getServerTrackingAttributes } from '@contentful/optimization-nextjs/tracking-attributes'

export type PagesRouterContentHandoff = NonNullable<
  Parameters<typeof OptimizationRoot>[0]['handoff']
>
