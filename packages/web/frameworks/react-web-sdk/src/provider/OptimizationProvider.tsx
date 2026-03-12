import ContentfulOptimization, { type OptimizationWebConfig } from '@contentful/optimization-web'
import { useRef, type PropsWithChildren, type ReactElement } from 'react'

import { OptimizationContext } from '../context/OptimizationContext'

export interface OptimizationProviderProps extends PropsWithChildren<OptimizationWebConfig> {}

export function OptimizationProvider(props: OptimizationProviderProps): ReactElement {
  const { children, ...config } = props
  const instanceRef = useRef<ContentfulOptimization | null>(null)

  instanceRef.current ??= new ContentfulOptimization(config)

  return (
    <OptimizationContext.Provider value={{ instance: instanceRef.current }}>
      {children}
    </OptimizationContext.Provider>
  )
}
