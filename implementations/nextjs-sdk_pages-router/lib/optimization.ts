import { bindNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router'
import { appConfig } from './config'
import { getBrowserAppConsent } from './util'

function getBrowserClientDefaults(): {
  readonly consent: boolean
  readonly persistenceConsent: boolean
} {
  const consent = getBrowserAppConsent() ?? false

  return { consent, persistenceConsent: consent }
}

export const {
  NextPagesAutoPageTracker,
  OptimizationAnalyticsRoot,
  OptimizationRoot,
  OptimizedEntry,
  createHandoffFromSelections,
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
})

export type PagesRouterContentHandoff = NonNullable<
  Parameters<typeof OptimizationRoot>[0]['handoff']
>
