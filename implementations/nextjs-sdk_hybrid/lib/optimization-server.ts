import {
  createNextjsOptimization,
  getNextjsServerOptimizationData,
} from '@contentful/optimization-nextjs/server'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { APP_LOCALE, optimizationConfig } from './config'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

const optimization = createNextjsOptimization({
  clientId: optimizationConfig.clientId,
  environment: optimizationConfig.environment,
  locale: optimizationConfig.locale,
  logLevel: 'debug',
  api: optimizationConfig.api,
  app: {
    name: 'Contentful Optimization Next.js SDK Hybrid (Server)',
    version: '0.1.0',
  },
})

const getOptimizationData = cache(async () => {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const appConsent = cookieStore.get(APP_PERSONALIZATION_CONSENT_COOKIE)?.value === 'granted'

  if (!appConsent) return undefined

  const { data } = await getNextjsServerOptimizationData(optimization, {
    consent: { events: true, persistence: true },
    cookies: cookieStore,
    headers: headerStore,
    locale: APP_LOCALE,
  })

  return data
})

export { getOptimizationData, optimization }
