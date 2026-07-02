import { useRef } from 'react'

export type InitResult<T> = { readonly value: T } | { readonly error: unknown } | undefined

export interface Lifecycle<T> {
  readonly init: () => InitResult<T>
  readonly mount: (onMount: (value: T) => void, onFail: (error: unknown) => void) => () => void
}

export function useLifecycle<T>(
  initialize: () => T | Promise<T>,
  dispose: (value: T) => void,
): Lifecycle<T> {
  const ref = useRef<T | undefined>(undefined)

  function unmount(): void {
    if (ref.current !== undefined) dispose(ref.current)
    ref.current = undefined
  }

  return {
    init() {
      if (ref.current !== undefined) unmount()
      try {
        const value = initialize()
        if (!(value instanceof Promise)) {
          ref.current = value
          return { value }
        }
      } catch (error: unknown) {
        return { error }
      }
      return undefined
    },
    mount(onMount, onFail) {
      if (ref.current !== undefined) return unmount

      let disposed = false

      function commit(value: T): void {
        if (disposed) {
          dispose(value)
          return
        }
        ref.current = value
        onMount(value)
      }

      function fail(error: unknown): void {
        if (!disposed) onFail(error)
      }

      try {
        const result = initialize()
        if (result instanceof Promise) {
          void result.then(commit, fail)
        } else {
          commit(result)
        }
      } catch (error: unknown) {
        fail(error)
      }

      return () => {
        disposed = true
        unmount()
      }
    },
  }
}
