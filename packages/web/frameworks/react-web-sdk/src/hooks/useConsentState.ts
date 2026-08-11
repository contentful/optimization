import type { OptimizationSdk } from '../context/OptimizationContext'
import { useObservableState, type ObservableValue } from './useObservableState'
import { useOptimization } from './useOptimization'

/**
 * Returns the current consent state.
 *
 * @public
 */
export function useConsentState(): ObservableValue<OptimizationSdk['states']['consent']> {
  const sdk = useOptimization()
  return useObservableState(sdk.states.consent)
}
