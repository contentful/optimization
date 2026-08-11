import { useCallback, useRef, useSyncExternalStore } from 'react'

export type ObservableValue<T> = T extends { readonly current: infer V } ? V : never

interface ObservableLike<T> {
  readonly current: T
  readonly subscribe: (next: (value: T) => void) => { unsubscribe: () => void }
}

export function useObservableState<T>(observable: ObservableLike<T>): T {
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

  return useSyncExternalStore(subscribe, getSnapshot, () => observable.current)
}
