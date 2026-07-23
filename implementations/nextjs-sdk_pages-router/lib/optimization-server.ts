import { bindNextjsPagesRouterServerOptimization } from '@contentful/optimization-nextjs/pages-router/server'
import type { GetServerSidePropsContext } from 'next'
import { appConfig } from './config'
import type { PagesRouterContentHandoff } from './optimization'
import { getAppConsent } from './util'

const { createRequestHandoff } = bindNextjsPagesRouterServerOptimization({
  clientId: appConfig.clientId,
  environment: appConfig.environment,
  locale: appConfig.locale,
  logLevel: 'debug',
  api: appConfig.api,
  consent: {
    server: ({ cookies }) => (getAppConsent(cookies) ? { events: true, persistence: true } : false),
  },
  app: {
    name: 'Contentful Optimization Next.js SDK Pages Router',
    version: '0.1.0',
  },
})

export interface PagesRouterOptimizationProps {
  readonly contentfulOptimization: {
    readonly consent: boolean
    readonly handoff: PagesRouterContentHandoff
  }
}

function assertContentHandoff(
  handoff: Awaited<ReturnType<typeof createRequestHandoff>>,
): asserts handoff is PagesRouterContentHandoff {
  if (handoff.hydration === 'analytics-only') {
    throw new Error('Pages Router request handoff must be content-capable.')
  }
}

function createRoutePagePayload(routeKey: string): {
  readonly properties: {
    readonly path: string
    readonly search: string
    readonly url: string
  }
} {
  const [path = '/', search = ''] = routeKey.split('?')

  return {
    properties: {
      path,
      search: search ? `?${search}` : '',
      url: routeKey,
    },
  }
}

export async function getPagesRouterOptimizationProps(
  context: GetServerSidePropsContext,
): Promise<PagesRouterOptimizationProps['contentfulOptimization']> {
  const routeKey = context.resolvedUrl || context.req.url || '/'
  const consent = context.req.cookies[appConfig.personalizationConsentCookie] === 'granted'
  const handoff = await createRequestHandoff(context, {
    cache: { scope: 'private-request' },
    hydration: 'preserve-server',
    pagePayload: createRoutePagePayload(routeKey),
  })
  assertContentHandoff(handoff)

  return { consent, handoff }
}
