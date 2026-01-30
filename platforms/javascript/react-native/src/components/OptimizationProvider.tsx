import { createScopedLogger } from '@contentful/optimization-core'
import React, { type ReactNode } from 'react'
import type Optimization from '../'
import OptimizationContext from '../context/OptimizationContext'

const logger = createScopedLogger('RN:Provider')

export interface OptimizationProviderProps {
  /**
   * The Optimization instance to provide to child components
   */
  instance: Optimization

  /**
   * Children components that will have access to the Optimization instance
   */
  children?: ReactNode
}

/**
 * Optimization Provider Component
 *
 * Provides the Optimization instance to all child components via React Context.
 * This allows components like OptimizationTrackedView to access analytics tracking
 * without requiring props drilling.
 *
 * @example
 * ```tsx
 * const optimization = await Optimization.create({
 *   clientId: 'your-client-id',
 *   environment: 'master'
 * })
 *
 * <OptimizationProvider instance={optimization}>
 *   <App />
 * </OptimizationProvider>
 * ```
 */
export function OptimizationProvider({
  instance,
  children,
}: OptimizationProviderProps): React.JSX.Element {
  // Log to verify the provider is working
  React.useEffect(() => {
    logger.info('Provider initialized')
  }, [])

  return (
    <OptimizationContext.Provider value={{ instance }}>{children}</OptimizationContext.Provider>
  )
}

export default OptimizationProvider
