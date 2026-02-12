import React from 'react'
import { useOptimization } from '../hooks/useOptimization'

export interface OptimizationStateProps {
  children: (ready: boolean) => React.ReactNode
}

export function OptimizationState({ children }: OptimizationStateProps): React.JSX.Element {
  const optimization = useOptimization()

  return <>{children(Boolean(optimization))}</>
}

export default OptimizationState
