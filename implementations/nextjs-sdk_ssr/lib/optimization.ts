import { createNextjsOptimization } from '@contentful/optimization-nextjs/server'
import { optimizationConfig } from './config'

export const optimization = createNextjsOptimization({
  clientId: optimizationConfig.clientId,
  environment: optimizationConfig.environment,
  locale: optimizationConfig.locale,
  logLevel: 'debug',
  api: optimizationConfig.api,
  app: {
    name: 'Contentful Optimization Next.js SDK SSR (Server)',
    version: '0.1.0',
  },
})
