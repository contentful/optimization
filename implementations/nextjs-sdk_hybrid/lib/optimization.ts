import {
  createNextjsOptimization,
  getNextjsServerOptimizationData,
} from '@contentful/optimization-nextjs/server'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { appConfig } from './config'
import { getAppConsent } from './util'

export const optimization = createNextjsOptimization({
  clientId: appConfig.clientId,
  environment: appConfig.environment,
  locale: appConfig.locale,
  logLevel: 'debug',
  api: appConfig.api,
  app: {
    name: 'Contentful Optimization Next.js SDK Hybrid (Server)',
    version: '0.1.0',
  },
})

// cache() deduplicates repeated calls for the same request during one render.
export const getOptimizationData = cache(async () => {
  const cookieStore = await cookies()
  const headerStore = await headers()

  // Resolve on the server regardless of consent so first-paint SSR matches the
  // browser SDK, which resolves the initial `page()` before consent by default
  // (`allowedEventTypes` includes `page`). Consent gates event emission and
  // profile persistence — not experience resolution — so pass the real consent
  // state rather than short-circuiting to baseline.
  const consented = getAppConsent(cookieStore)

  const { data } = await getNextjsServerOptimizationData(optimization, {
    consent: { events: consented, persistence: consented },
    cookies: cookieStore,
    headers: headerStore,
    locale: appConfig.locale,
  })

  return data
})
