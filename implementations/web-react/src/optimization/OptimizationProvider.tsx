import { createContext, type JSX, type PropsWithChildren, useMemo } from 'react'
import { getOptimization, type OptimizationInstance } from './createOptimization'

export interface OptimizationContextValue {
  sdk: OptimizationInstance | undefined
  isReadable: boolean
  error: Error | undefined
}

export const OptimizationContext = createContext<OptimizationContextValue | undefined>(undefined)

export function OptimizationProvider({ children }: PropsWithChildren): JSX.Element {
  const value = useMemo<OptimizationContextValue>(() => {
    try {
      const sdk = getOptimization()
      return { sdk, isReadable: true, error: undefined }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Optimization init error'
      return {
        sdk: undefined,
        isReadable: false,
        error: error instanceof Error ? error : new Error(message),
      }
    }
  }, [])

  return <OptimizationContext.Provider value={value}>{children}</OptimizationContext.Provider>
}
