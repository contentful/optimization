import type { OptimizationWebSdkOrNull } from '../types'

export interface UseOptimizationResult {
  readonly optimization: OptimizationWebSdkOrNull
  readonly isReady: boolean
}

export function useOptimization(): UseOptimizationResult {
  // Scaffold placeholder: reads from provider context will be added later.
  return {
    optimization: null,
    isReady: false,
  }
}
