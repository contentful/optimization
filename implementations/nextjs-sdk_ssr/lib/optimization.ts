import { createNextjsOptimization } from '@contentful/optimization-nextjs/server'
import { appConfig } from './config'

export const optimization = createNextjsOptimization({
  clientId: appConfig.clientId,
  environment: appConfig.environment,
  locale: appConfig.locale,
  logLevel: 'debug',
  api: appConfig.api,
  app: {
    name: 'Contentful Optimization Next.js SDK SSR (Server)',
    version: '0.1.0',
  },
})
