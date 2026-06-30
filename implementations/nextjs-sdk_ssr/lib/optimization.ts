import {
  createNextjsOptimization,
  getNextjsServerOptimizationData,
} from '@contentful/optimization-nextjs/server'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { appConfig } from './config'
import { getAppConsent } from './consent'

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

export const getOptimizationData = cache(async () => {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const hasConsent = getAppConsent(cookieStore)
  const { data } = await getNextjsServerOptimizationData(optimization, {
    consent: { events: hasConsent, persistence: hasConsent },
    cookies: hasConsent ? cookieStore : undefined,
    headers: headerStore,
    locale: appConfig.locale,
  })

  return { data, hasConsent }
})
