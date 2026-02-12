import React from 'react'
import OptimizationContext from '../context/OptimizationContext'
import {
  createOptimizationInstance,
  type ReactOptimizationInstance,
  type ReactSdkConfig,
} from '../runtime/createOptimizationInstance'

export interface OptimizationProviderProps {
  config: ReactSdkConfig
  children?: React.ReactNode
}

export function OptimizationProvider({
  config,
  children,
}: OptimizationProviderProps): React.JSX.Element {
  const instanceRef = React.useRef<ReactOptimizationInstance | null>(null)
  const errorRef = React.useRef<Error | null>(null)

  if (!instanceRef.current && !errorRef.current) {
    try {
      instanceRef.current = createOptimizationInstance(config)
    } catch (error) {
      errorRef.current = error instanceof Error ? error : new Error(String(error))
    }
  }

  React.useEffect(
    () => () => {
      instanceRef.current?.destroy()
      if (instanceRef.current) {
        instanceRef.current.status = 'destroyed'
      }
    },
    [],
  )

  if (errorRef.current) {
    throw errorRef.current
  }

  if (!instanceRef.current) {
    throw new Error('OptimizationProvider failed to initialize Optimization runtime.')
  }

  return (
    <OptimizationContext.Provider
      value={{
        instance: instanceRef.current,
        isReady: instanceRef.current.status === 'ready',
        lastError: null,
      }}
    >
      {children}
    </OptimizationContext.Provider>
  )
}

export default OptimizationProvider
