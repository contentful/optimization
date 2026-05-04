'use client'

// The Web SDK requires browser APIs (localStorage, document.cookie) and cannot
// be instantiated during SSR. Using next/dynamic with ssr:false ensures the
// OptimizationProvider (and its OptimizationRoot) is only loaded and rendered
// on the client. Without this, child components that call useOptimization()
// would throw when rendered outside the provider during server rendering.
// This causes a brief flash of empty content before the SDK mounts.

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'

const OptimizationProvider = dynamic(
  () =>
    import('./OptimizationProvider').then((mod) => ({
      default: mod.OptimizationProvider,
    })),
  { ssr: false },
)

interface ClientProviderWrapperProps {
  readonly children: ReactNode
}

export function ClientProviderWrapper({ children }: ClientProviderWrapperProps) {
  return <OptimizationProvider>{children}</OptimizationProvider>
}
