import ContentfulOptimization from '@contentful/optimization-node'
import { optimizationConfig } from './config'

const sdk = new ContentfulOptimization({
  clientId: optimizationConfig.clientId,
  environment: optimizationConfig.environment,
  contentfulLocales: optimizationConfig.contentfulLocales,
  logLevel: 'debug',
  api: optimizationConfig.api,
  app: {
    name: 'ContentfulOptimization SDK - Next.js SSR Hybrid (Server)',
    version: '0.1.0',
  },
})

function requireContentfulLocale(contentfulLocale: string | undefined): string {
  if (contentfulLocale !== undefined) return contentfulLocale

  throw new Error('This implementation requires contentfulLocales for localized CDA fetches.')
}

export { requireContentfulLocale, sdk }
