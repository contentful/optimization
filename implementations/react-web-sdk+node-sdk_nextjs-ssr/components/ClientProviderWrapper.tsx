'use client'

// The Web SDK requires browser APIs (localStorage, document.cookie) and cannot
// be instantiated during SSR. Using next/dynamic with ssr:false ensures
// OptimizationRoot is only loaded and rendered on the client. Without this,
// child components that call useOptimization() would throw when rendered
// outside the provider during server rendering.

import { optimizationConfig } from '@/lib/config'
import dynamic from 'next/dynamic'
import { Suspense, type ReactNode } from 'react'

const OptimizationRoot = dynamic(
  () =>
    import('@contentful/optimization-react-web').then((mod) => ({
      default: mod.OptimizationRoot,
    })),
  { ssr: false },
)

const NextAppAutoPageTracker = dynamic(
  () =>
    import('@contentful/optimization-react-web/router/next-app').then((mod) => ({
      default: mod.NextAppAutoPageTracker,
    })),
  { ssr: false },
)

interface ClientProviderWrapperProps {
  readonly children: ReactNode
}

export function ClientProviderWrapper({ children }: ClientProviderWrapperProps) {
  return (
    <OptimizationRoot
      clientId={optimizationConfig.clientId}
      environment={optimizationConfig.environment}
      api={optimizationConfig.api}
      autoTrackEntryInteraction={{ views: true, clicks: true, hovers: true }}
      logLevel="debug"
      app={{
        name: 'ContentfulOptimization SDK - Next.js SSR Hybrid (Client)',
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
