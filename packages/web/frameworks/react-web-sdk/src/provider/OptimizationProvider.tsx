import ContentfulOptimization, { type OptimizationWebConfig } from '@contentful/optimization-web'
import { useEffect, useRef, type PropsWithChildren, type ReactElement } from 'react'

import { OptimizationContext } from '../context/OptimizationContext'

export interface OptimizationProviderProps extends PropsWithChildren<OptimizationWebConfig> {}

export function OptimizationProvider(props: OptimizationProviderProps): ReactElement {
  const { children, ...config } = props
  const instanceRef = useRef<ContentfulOptimization | null>(null)
  const errorRef = useRef<Error | null>(null)

  if (instanceRef.current === null && errorRef.current === null) {
    try {
      instanceRef.current = new ContentfulOptimization(config)
    } catch (error) {
      errorRef.current = error instanceof Error ? error : new Error(String(error))
    }
  }

  useEffect(
    () => () => {
      instanceRef.current?.destroy()
      instanceRef.current = null
    },
    [],
  )

  return (
    <OptimizationContext.Provider
      value={{
        sdk: instanceRef.current ?? undefined,
        isReady: instanceRef.current !== null,
        error: errorRef.current ?? undefined,
      }}
    >
      {children}
    </OptimizationContext.Provider>
  )
}
