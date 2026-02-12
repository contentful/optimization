import React from 'react'
import { useOptimization } from '../hooks/useOptimization'

export interface OptimizationConsumerProps {
  children: (optimization: ReturnType<typeof useOptimization>) => React.ReactNode
}

export function OptimizationConsumer({ children }: OptimizationConsumerProps): React.JSX.Element {
  const optimization = useOptimization()

  return <>{children(optimization)}</>
}

export default OptimizationConsumer
