import type { OptimizationData } from '@contentful/optimization-nextjs/server'
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
    name: 'Contentful Optimization Next.js SDK SSR (Server)',
    version: '0.1.0',
  },
})

/**
 * Resolve the request-scoped Optimization data once per request.
 *
 * The root layout and the page both need this data — the layout to seed the
 * isomorphic provider, the page to resolve entry variants. `cache` deduplicates
 * the call across the request so exactly one Experience `page()` event is
 * emitted, regardless of how many server components ask for it.
 */
export const getServerOptimizationData = cache(async (): Promise<OptimizationData | undefined> => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])

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
