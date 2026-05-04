'use client'

import { optimizationConfig } from '@/lib/config'
import { OptimizationRoot } from '@contentful/optimization-react-web'
import { NextAppAutoPageTracker } from '@contentful/optimization-react-web/router/next-app'
import { Suspense, type ReactElement, type ReactNode } from 'react'

interface OptimizationProviderProps {
  readonly children: ReactNode
}

export function OptimizationProvider({ children }: OptimizationProviderProps): ReactElement {
  return (
    <OptimizationRoot
      clientId={optimizationConfig.clientId}
      environment={optimizationConfig.environment}
      api={optimizationConfig.api}
      autoTrackEntryInteraction={{ views: true, clicks: true, hovers: true }}
      logLevel="debug"
      app={{
        name: 'ContentfulOptimization SDK - Next.js Reference',
        version: '0.1.0',
      }}
    >
      <Suspense>
        <NextAppAutoPageTracker />
      </Suspense>
      {children}
    </OptimizationRoot>
  )
}
