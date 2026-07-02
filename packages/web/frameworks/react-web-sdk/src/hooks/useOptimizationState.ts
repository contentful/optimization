import { useCallback, useRef, useSyncExternalStore } from 'react'

import type { OptimizationSdk } from '../context/OptimizationContext'
import { useOptimization } from './useOptimization'

type OptimizationStates = OptimizationSdk['states']
type ObservableValue<T> = T extends { readonly current: infer V } ? V : never

interface ObservableLike<T> {
  readonly current: T
  readonly subscribe: (next: (value: T) => void) => { unsubscribe: () => void }
}

function useObservableState<T>(observable: ObservableLike<T>): T {
  const snapshotRef = useRef<T>(observable.current)
  const observableRef = useRef(observable)

  if (observableRef.current !== observable) {
    const { current } = observable
    observableRef.current = observable
    snapshotRef.current = current
  }

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = observable.subscribe((value) => {
        snapshotRef.current = value
        onStoreChange()
      })

      return () => {
        const { unsubscribe } = subscription
        unsubscribe()
      }
    },
    [observable],
  )

  const getSnapshot = useCallback(() => snapshotRef.current, [])

  // On the server (and the initial hydration render) React uses the third
  // argument. Read directly from the observable's current value so the server
  // snapshot matches the value the client is seeded with, avoiding hydration
  // mismatches. The observable is a static, request-scoped snapshot server-side.
  const getServerSnapshot = useCallback(() => observable.current, [observable])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Returns the current consent state.
 *
 * @public
 */
export function useConsentState(): ObservableValue<OptimizationStates['consent']> {
  const sdk = useOptimization()
  return useObservableState(sdk.states.consent)
}

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
