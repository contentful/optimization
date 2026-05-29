'use client'

import { optimizationConfig } from '@/lib/config'
import type {
  ChangeArray,
  Profile,
  SelectedOptimizationArray,
} from '@contentful/optimization-react-web/api-schemas'
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
  readonly contentfulLocale: string
  readonly defaults?: {
    profile?: Profile
    selectedOptimizations?: SelectedOptimizationArray
    changes?: ChangeArray
  }
}

export function ClientProviderWrapper({
  children,
  contentfulLocale,
  defaults,
}: ClientProviderWrapperProps) {
  return (
    <OptimizationRoot
      clientId={optimizationConfig.clientId}
      environment={optimizationConfig.environment}
      contentfulLocales={optimizationConfig.contentfulLocales}
      locale={contentfulLocale}
      api={optimizationConfig.api}
      trackEntryInteraction={{ views: true, clicks: true, hovers: true }}
      logLevel="debug"
      defaults={defaults}
      app={{
        name: 'ContentfulOptimization SDK - Next.js SSR+CSR Hybrid (Client)',
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
