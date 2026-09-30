'use client'

import { appConfig } from '@/lib/config'
import type { createEdgeRequestHandoff } from '@/lib/edge-optimization'
import { bindNextjsAppRouterClientOptimization } from '@contentful/optimization-nextjs/app-router/client'
import type { ReactNode } from 'react'

const optimization = bindNextjsAppRouterClientOptimization({
  spaceId: appConfig.spaceId,
  environment: appConfig.environment,
  locale: appConfig.locale,
  logLevel: 'debug',
  api: appConfig.api,
  app: {
    name: 'Contentful Optimization Next.js SDK Edge runtime',
    version: '0.1.0',
  },
  consent: {
    clientDefaults: { consent: false, persistenceConsent: false },
  },
})

type EdgeBrowserHandoff = Awaited<ReturnType<typeof createEdgeRequestHandoff>>['handoff']
export type EdgeContentHandoff = Extract<
  EdgeBrowserHandoff,
  { readonly hydration: 'preserve-server' | 'client-only-hidden-until-ready' }
>

export function EdgeHandoff({
  children,
  handoff,
  routeKey,
}: Readonly<{
  children: ReactNode
  handoff: EdgeContentHandoff
  routeKey: string
}>) {
  return (
    <optimization.OptimizationRoot
      buildPagePayload={() => ({ properties: { path: routeKey, url: routeKey } })}
      handoff={handoff}
      routeKey={routeKey}
    >
      {children}
    </optimization.OptimizationRoot>
  )
}
