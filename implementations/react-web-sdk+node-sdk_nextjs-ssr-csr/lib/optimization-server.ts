import ContentfulOptimization from '@contentful/optimization-node'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { optimizationConfig } from './config'

const sdk = new ContentfulOptimization({
  clientId: optimizationConfig.clientId,
  environment: optimizationConfig.environment,
  contentfulLocales: optimizationConfig.contentfulLocales,
  logLevel: 'debug',
  api: optimizationConfig.api,
  app: {
    name: 'ContentfulOptimization SDK - Next.js SSR+CSR Hybrid (Server)',
    version: '0.1.0',
  },
})

const getOptimizationData = cache(async (eventLocale: string, contentfulLocale: string) => {
  const cookieStore = await cookies()
  const headerStore = await headers()

  const anonymousId = cookieStore.get(ANONYMOUS_ID_COOKIE)?.value
  const profile = anonymousId ? { id: anonymousId } : undefined

  return sdk.page(
    {
      locale: eventLocale,
      userAgent: headerStore.get('user-agent') ?? 'next-js-server',
      profile,
    },
    { locale: contentfulLocale },
  )
})

function requireContentfulLocale(contentfulLocale: string | undefined): string {
  if (contentfulLocale !== undefined) return contentfulLocale

  throw new Error('This implementation requires contentfulLocales for localized CDA fetches.')
}

export { getOptimizationData, requireContentfulLocale, sdk }
