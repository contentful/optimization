import Optimization, { type OptimizationConfig } from '@contentful/optimization-web'
import { useRef, type PropsWithChildren, type ReactElement } from 'react'

import { OptimizationContext } from '../context/OptimizationContext'

export interface OptimizationProviderProps extends PropsWithChildren<OptimizationConfig> {}

export function OptimizationProvider(props: OptimizationProviderProps): ReactElement {
  const { children, ...config } = props
  const instanceRef = useRef<Optimization | null>(null)

  instanceRef.current ??= new Optimization(config)

  return (
    <OptimizationContext.Provider value={{ instance: instanceRef.current }}>
      {children}
    </OptimizationContext.Provider>
  )
}
