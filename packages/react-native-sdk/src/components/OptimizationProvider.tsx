import { createScopedLogger } from '@contentful/optimization-core/logger'
import React, { useEffect, useRef, useState, type ReactNode } from 'react'
import type { OptimizationConfig } from '..'
import OptimizationContext from '../context/OptimizationContext'
import OptimizationReactNativeSdk from '../OptimizationReactNativeSdk'

const logger = createScopedLogger('RN:Provider')

/**
 * Props for the {@link OptimizationProvider} component.
 *
 * Accepts all {@link OptimizationConfig} properties directly. Only `clientId` is required.
 *
 * @public
 */
export interface OptimizationProviderProps extends OptimizationConfig {
  /**
   * Children components that will have access to the Optimization instance.
   */
  children?: ReactNode
}

/**
 * Provides the Optimization instance to all child components via React Context.
 *
 * Handles SDK initialization, loading state, and cleanup internally.
 * Children are not rendered until the SDK is ready (loading gate).
 *
 * @param props - Config properties and children
 * @returns A context provider wrapping the children, or `null` while initializing
 *
 * @remarks
 * Config is captured on first render and subsequent prop changes are ignored.
 * To force re-initialization, change the React `key` prop.
 *
 * Prefer using {@link OptimizationRoot} instead, which wraps this provider
 * with additional functionality such as live updates and the preview panel.
 *
 * @example
 * ```tsx
 * <OptimizationProvider clientId="your-client-id" environment="main">
 *   <App />
 * </OptimizationProvider>
 * ```
 *
 * @see {@link OptimizationRoot}
 *
 * @public
 */
export function OptimizationProvider({
  children,
  ...config
}: OptimizationProviderProps): React.JSX.Element | null {
  const configRef = useRef<OptimizationConfig>(config)
  const [instance, setInstance] = useState<OptimizationReactNativeSdk | null>(null)
  const [initError, setInitError] = useState<Error | null>(null)

  useEffect(() => {
    let destroyed = false

    void OptimizationReactNativeSdk.create(configRef.current)
      .then((sdk) => {
        if (destroyed) {
          sdk.destroy()
          return
        }

        logger.info('Provider initialized')
        setInstance(sdk)
      })
      .catch((error: unknown) => {
        if (destroyed) return

        const err = error instanceof Error ? error : new Error(String(error))
        logger.error('Failed to initialize SDK:', err.message)
        setInitError(err)
      })

    return () => {
      destroyed = true
    }
  }, [])

  useEffect(
    () => () => {
      if (instance) {
        instance.destroy()
      }
    },
    [instance],
  )

  if (!instance) {
    return null
  }

  return (
    <OptimizationContext.Provider value={{ instance, isReady: true, initError }}>
      {children}
    </OptimizationContext.Provider>
  )
}

export default OptimizationProvider
