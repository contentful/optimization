import { useCallback, useRef, useSyncExternalStore } from 'react'

import type { OptimizationSdk } from '../context/OptimizationContext'
import { useOptimizationContext } from './useOptimization'

type OptimizationStates = OptimizationSdk['states']
type ObservableValue<T> = T extends { readonly current: infer V } ? V : never

interface ObservableLike<T> {
  readonly current: T
  readonly subscribe: (next: (value: T) => void) => { unsubscribe: () => void }
}

// Stable no-op observable used when the SDK is not yet ready (SSR / initial
// client render). Every state hook falls back to this so SSR does not crash.
const NOOP_SUBSCRIPTION = { unsubscribe: (): void => undefined }
function emptyObservable<T>(value: T): ObservableLike<T> {
  return { current: value, subscribe: () => NOOP_SUBSCRIPTION }
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

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * Returns the current consent state. Returns `undefined` before the SDK is ready.
 *
 * @public
 */
export function useConsentState(): ObservableValue<OptimizationStates['consent']> {
  const { sdk } = useOptimizationContext()
  return useObservableState(sdk?.states.consent ?? emptyObservable(undefined))
}

/**
 * Returns whether optimization data is currently available. Returns `false`
 * before the SDK is ready.
 *
 * @public
 */
export function useCanOptimizeState(): ObservableValue<OptimizationStates['canOptimize']> {
  const { sdk } = useOptimizationContext()
  return useObservableState(sdk?.states.canOptimize ?? emptyObservable(false))
}

/**
 * Returns the latest emitted event payload. Returns `undefined` before the SDK
 * is ready.
 *
 * @public
 */
export function useEventStreamState(): ObservableValue<OptimizationStates['eventStream']> {
  const { sdk } = useOptimizationContext()
  return useObservableState(sdk?.states.eventStream ?? emptyObservable(undefined))
}

/**
 * Returns the current profile state. Returns `undefined` before the SDK is ready.
 *
 * @public
 */
export function useProfileState(): ObservableValue<OptimizationStates['profile']> {
  const { sdk } = useOptimizationContext()
  return useObservableState(sdk?.states.profile ?? emptyObservable(undefined))
}

/**
 * Returns the current selected optimizations state. Returns `undefined` before
 * the SDK is ready.
 *
 * @public
 */
export function useSelectedOptimizationsState(): ObservableValue<
  OptimizationStates['selectedOptimizations']
> {
  const { sdk } = useOptimizationContext()
  return useObservableState(sdk?.states.selectedOptimizations ?? emptyObservable(undefined))
}
