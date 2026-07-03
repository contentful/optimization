import { createNextjsPagesRouterOptimization } from '@contentful/optimization-nextjs/pages-router/server'
import type { GetServerSidePropsContext } from 'next'
import { appConfig } from './config'

const { getServerSideOptimizationProps } = createNextjsPagesRouterOptimization({
  clientId: appConfig.clientId,
  environment: appConfig.environment,
  locale: appConfig.locale,
  logLevel: 'debug',
  api: appConfig.api,
  app: {
    name: 'Contentful Optimization Next.js SDK Pages Router',
    version: '0.1.0',
  },
  server: {
    consent: (context: GetServerSidePropsContext) =>
      context.req.cookies[appConfig.personalizationConsentCookie] === 'granted'
        ? { events: true, persistence: true }
        : false,
  },
})

export function getPagesRouterOptimizationProps(context: GetServerSidePropsContext) {
  return getServerSideOptimizationProps(context)
}
