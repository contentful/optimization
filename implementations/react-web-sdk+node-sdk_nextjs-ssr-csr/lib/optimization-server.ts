import ContentfulOptimization from '@contentful/optimization-node'
import { ANONYMOUS_ID_COOKIE } from '@contentful/optimization-node/constants'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { optimizationConfig } from './config'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

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
  const appConsent = cookieStore.get(APP_PERSONALIZATION_CONSENT_COOKIE)?.value === 'granted'

  if (!appConsent) return undefined

  const anonymousId = cookieStore.get(ANONYMOUS_ID_COOKIE)?.value
  const profile = anonymousId ? { id: anonymousId } : undefined

  const requestOptimization = sdk.forRequest({
    consent: { events: true, persistence: true },
    eventContext: {
      locale: eventLocale,
      userAgent: headerStore.get('user-agent') ?? 'next-js-server',
    },
    experienceOptions: { locale: contentfulLocale },
    profile,
  })

  return requestOptimization.page()
})

function requireContentfulLocale(contentfulLocale: string | undefined): string {
  if (contentfulLocale !== undefined) return contentfulLocale

  throw new Error('This implementation requires contentfulLocales for localized CDA fetches.')
}

export { getOptimizationData, requireContentfulLocale, sdk }
