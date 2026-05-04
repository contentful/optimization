'use client'

import { optimizationConfig } from '@/lib/config'
import { OptimizationRoot } from '@contentful/optimization-react-web'
import { NextAppAutoPageTracker } from '@contentful/optimization-react-web/router/next-app'
import { Suspense, useEffect, useState, type ReactNode } from 'react'

interface OptimizationProviderProps {
  readonly children: ReactNode
}

export function OptimizationProvider({ children }: OptimizationProviderProps): ReactNode {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // The Web SDK requires browser APIs (localStorage, document.cookie) and cannot
  // be instantiated during SSR. We must return `null` rather than rendering
  // children without <OptimizationRoot>, because child components that call
  // useOptimization() / useOptimizationContext() will throw if rendered outside
  // the provider. This causes a brief flash of empty content before the SDK
  // mounts on the client.
  if (!mounted) {
    return null
  }

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
