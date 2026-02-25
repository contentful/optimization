import { createScopedLogger } from '@contentful/optimization-core'
import React, { type ReactNode } from 'react'
import type Optimization from '../'
import OptimizationContext from '../context/OptimizationContext'

const logger = createScopedLogger('RN:Provider')

/**
 * Props for the {@link OptimizationProvider} component.
 *
 * @public
 */
export interface OptimizationProviderProps {
  /**
   * The Optimization instance to provide to child components.
   */
  instance: Optimization

  /**
   * Children components that will have access to the Optimization instance.
   */
  children?: ReactNode
}

/**
 * Provides the Optimization instance to all child components via React Context.
 *
 * @param props - Component props
 * @returns A context provider wrapping the children
 *
 * @remarks
 * Prefer using {@link OptimizationRoot} instead, which wraps this provider
 * with additional functionality such as live updates and the preview panel.
 *
 * @example
 * ```tsx
 * const optimization = await Optimization.create({
 *   clientId: 'your-client-id',
 *   environment: 'main',
 * })
 *
 * <OptimizationProvider instance={optimization}>
 *   <App />
 * </OptimizationProvider>
 * ```
 *
 * @see {@link OptimizationRoot}
 *
 * @public
 */
export function OptimizationProvider({
  instance,
  children,
}: OptimizationProviderProps): React.JSX.Element {
  React.useEffect(() => {
    logger.info('Provider initialized')
  }, [])

  return (
    <OptimizationContext.Provider value={{ instance }}>{children}</OptimizationContext.Provider>
  )
}

export default OptimizationProvider
