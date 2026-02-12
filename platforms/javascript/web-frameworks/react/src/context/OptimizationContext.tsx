import { createContext } from 'react'
import type { ReactOptimizationInstance } from '../runtime/createOptimizationInstance'

export interface OptimizationContextValue {
  instance: ReactOptimizationInstance
  isReady: boolean
  lastError: Error | null
}

const OptimizationContext = createContext<OptimizationContextValue | null>(null)

export default OptimizationContext
