'use client'

import { optimizationSdkConfig } from '@/lib/config'
import { getBrowserAppConsent } from '@/lib/util'
import {
  OptimizationAnalyticsRoot as ClientOptimizationAnalyticsRoot,
  OptimizationRoot as ClientOptimizationRoot,
  type AutoPagePayload,
  type OptimizationAnalyticsRootProps,
  type OptimizationRootProps,
} from '@contentful/optimization-nextjs/client'
import type { JSX, ReactNode } from 'react'

type PublicContentRootProps = {
  readonly children: ReactNode
  readonly handoff: NonNullable<OptimizationRootProps['handoff']>
  readonly initialPagePayload: AutoPagePayload
  readonly routeKey: string
}

type PublicAnalyticsRootProps = {
  readonly children: ReactNode
  readonly handoff: OptimizationAnalyticsRootProps['handoff']
  readonly initialPagePayload: AutoPagePayload
  readonly routeKey: string
}

function browserConsentDefaults(): {
  readonly consent: boolean
  readonly persistenceConsent: boolean
} {
  const consent = getBrowserAppConsent() === true
  return { consent, persistenceConsent: consent }
}

export function PublicContentRoot({
  children,
  handoff,
  initialPagePayload,
  routeKey,
}: PublicContentRootProps): JSX.Element {
  return (
    <ClientOptimizationRoot
      {...optimizationSdkConfig}
      defaults={browserConsentDefaults()}
      handoff={handoff}
      initialPagePayload={initialPagePayload}
      routeKey={routeKey}
    >
      {children}
    </ClientOptimizationRoot>
  )
}

export function PublicAnalyticsRoot({
  children,
  handoff,
  initialPagePayload,
  routeKey,
}: PublicAnalyticsRootProps): JSX.Element {
  return (
    <ClientOptimizationAnalyticsRoot
      {...optimizationSdkConfig}
      defaults={browserConsentDefaults()}
      handoff={handoff}
      initialPagePayload={initialPagePayload}
      routeKey={routeKey}
    >
      {children}
    </ClientOptimizationAnalyticsRoot>
  )
}
