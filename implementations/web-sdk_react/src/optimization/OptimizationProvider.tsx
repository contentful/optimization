import { createContext, type JSX, type PropsWithChildren, useMemo } from 'react'
import { getOptimization, type OptimizationInstance } from './createOptimization'

export interface OptimizationContextValue {
  sdk: OptimizationInstance | undefined
  isReady: boolean
  error: Error | undefined
}

export const OptimizationContext = createContext<OptimizationContextValue | undefined>(undefined)

export function OptimizationProvider({ children }: PropsWithChildren): JSX.Element {
  const value = useMemo<OptimizationContextValue>(() => {
    try {
      // Intentionally use a singleton SDK instance to avoid re-initialization during
      // React StrictMode double invocation in development.
      const sdk = getOptimization()
      return { sdk, isReady: true, error: undefined }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Optimization init error'
      return {
        sdk: undefined,
        isReady: false,
        error: error instanceof Error ? error : new Error(message),
      }
    }
  }, [])

  return <OptimizationContext.Provider value={value}>{children}</OptimizationContext.Provider>
}
