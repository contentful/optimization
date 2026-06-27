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

  if (!getAppConsent(cookieStore)) return undefined

  const { data } = await getNextjsServerOptimizationData(optimization, {
    consent: { events: true, persistence: true },
    cookies: cookieStore,
    headers: headerStore,
    locale: appConfig.locale,
  })

  return data
})
