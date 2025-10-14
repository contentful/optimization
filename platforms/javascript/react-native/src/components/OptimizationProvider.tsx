import { logger } from '@contentful/optimization-core'
import React, { type ReactNode } from 'react'

export interface OptimizationProviderProps {
  children?: ReactNode
}

/**
 * Optimization Provider Component
 * This component wraps the application to provide optimization context
 * It's a pass-through component that renders children without additional UI
 */
export function OptimizationProvider({ children }: OptimizationProviderProps): React.JSX.Element {
  // Log to verify the provider is working
  React.useEffect(() => {
    logger.info('Provider initialized')
  }, [])

  return <>{children}</>
}

export default OptimizationProvider
