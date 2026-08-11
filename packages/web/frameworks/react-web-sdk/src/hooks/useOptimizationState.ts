import type { OptimizationSdk } from '../context/OptimizationContext'
import { useObservableState, type ObservableValue } from './useObservableState'
import { useOptimization } from './useOptimization'

type OptimizationStates = OptimizationSdk['states']

/**
 * Returns whether optimization data is currently available.
 *
 * @public
 */
export function useCanOptimizeState(): ObservableValue<OptimizationStates['canOptimize']> {
  const sdk = useOptimization()
  return useObservableState(sdk.states.canOptimize)
}

/**
 * Returns the latest emitted event payload.
 *
 * @public
 */
export function useEventStreamState(): ObservableValue<OptimizationStates['eventStream']> {
  const sdk = useOptimization()
  return useObservableState(sdk.states.eventStream)
}

/**
 * Returns the current profile state.
 *
 * @public
 */
export function useProfileState(): ObservableValue<OptimizationStates['profile']> {
  const sdk = useOptimization()
  return useObservableState(sdk.states.profile)
}

/**
 * Returns the current selected optimizations state.
 *
 * @public
 */
export function useSelectedOptimizationsState(): ObservableValue<
  OptimizationStates['selectedOptimizations']
> {
  const sdk = useOptimization()
  return useObservableState(sdk.states.selectedOptimizations)
}
