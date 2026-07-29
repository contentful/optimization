import type { ContentOptimizationHydrationMode } from '@contentful/optimization-web/handoff'
import { createContext, useContext } from 'react'

export const OptimizationHydrationContext = createContext<
  ContentOptimizationHydrationMode | undefined
>(undefined)

export function useOptimizationHydrationMode(): ContentOptimizationHydrationMode | undefined {
  return useContext(OptimizationHydrationContext)
}
