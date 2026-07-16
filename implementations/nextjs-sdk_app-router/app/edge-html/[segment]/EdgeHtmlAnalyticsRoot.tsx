'use client'

import { appConfig } from '@/lib/config'
import {
  OptimizationAnalyticsRoot,
  type OptimizationAnalyticsRootProps,
} from '@contentful/optimization-nextjs/client'
import type { ReactNode } from 'react'

export function EdgeHtmlAnalyticsRoot({
  children,
  handoff,
  routeKey,
}: {
  readonly children: ReactNode
  readonly handoff: OptimizationAnalyticsRootProps['handoff']
  readonly routeKey: string
}) {
  return (
    <OptimizationAnalyticsRoot
      api={appConfig.api}
      app={{
        name: 'Contentful Optimization Next.js SDK App Router Edge HTML',
        version: '0.1.0',
      }}
      buildPagePayload={() => ({
        properties: {
          path: routeKey,
          url: window.location.href,
        },
      })}
      clientId={appConfig.clientId}
      defaults={{ consent: false, persistenceConsent: false }}
      environment={appConfig.environment}
      handoff={handoff}
      locale={appConfig.locale}
      routeKey={routeKey}
      trackEntryInteraction={{ views: true, clicks: true, hovers: true }}
    >
      {children}
    </OptimizationAnalyticsRoot>
  )
}
