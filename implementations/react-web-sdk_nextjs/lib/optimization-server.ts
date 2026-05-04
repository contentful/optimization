import ContentfulOptimization from '@contentful/optimization-node'
import { optimizationConfig } from './config'

const sdk = new ContentfulOptimization({
  clientId: optimizationConfig.clientId,
  environment: optimizationConfig.environment,
  logLevel: 'debug',
  api: optimizationConfig.api,
  app: {
    name: 'ContentfulOptimization SDK - Next.js Reference (Server)',
    version: '0.1.0',
  },
})

export { sdk }
