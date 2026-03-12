import { effect } from '@preact/signals-core'
import { cloneDeep } from 'es-toolkit'

/**
 * Disposable handle returned by observable subscriptions.
 *
 * @public
 */
export interface Subscription {
  /** Stop receiving future emissions for the subscription. */
  unsubscribe: () => void
}

/**
 * Minimal observable contract used by stateful Core signal streams.
 *
 * @typeParam T - Value type emitted by the observable.
 * @public
 */
export interface Observable<T> {
  /**
   * Deep-cloned snapshot of the current signal value.
   *
   * @remarks
   * A clone is returned to prevent accidental in-place mutations from leaking
   * back into internal signal state.
   */
  readonly current: T
  /**
   * Subscribe to all value updates (including the current value immediately).
   *
   * @param next - Callback invoked for each emitted value snapshot.
   * @returns A {@link Subscription} used to stop observing updates.
   *
   * @remarks
   * Values are deep-cloned before being passed to `next`.
   */
  subscribe: (next: (v: T) => void) => Subscription
  /**
   * Subscribe to the first non-nullish value, then auto-unsubscribe.
   *
   * @param next - Callback invoked exactly once with the first non-nullish value.
   * @returns A {@link Subscription} that can cancel before the first emission.
   *
   * @remarks
   * Values are deep-cloned before being passed to `next`.
   */
  subscribeOnce: (next: (v: NonNullable<T>) => void) => Subscription
}

function isNonNullish<TValue>(value: TValue): value is NonNullable<TValue> {
  return value !== undefined && value !== null
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value
  return new Error(`Subscriber threw non-Error value: ${String(value)}`)
}

/**
 * Wrap a signal-like object with the local {@link Observable} contract.
 *
 * @typeParam T - Signal value type.
 * @param s - Signal-like source exposing a `value` property.
 * @returns Observable adapter for the given signal source.
 *
 * @remarks
 * All emitted values and `current` snapshots are deep-cloned to isolate
 * subscriber-side mutation from internal Core state.
 *
 * @public
 */
export function toObservable<T>(s: { value: T }): Observable<T> {
  return {
    get current() {
      return cloneDeep(s.value)
    },

    subscribe(next) {
      const dispose = effect(() => {
        next(cloneDeep(s.value))
      })

      return { unsubscribe: dispose }
    },

    subscribeOnce(next) {
      let closed = false
      let isEffectActive = false
      let dispose: () => void = () => undefined

      const stop = (): void => {
        if (closed) return
        closed = true

        if (isEffectActive) dispose()
      }

      dispose = effect(() => {
        if (closed) return

        const { value } = s
        if (!isNonNullish(value)) return

        closed = true

        let callbackError: Error | null = null
        try {
          next(cloneDeep(value))
        } catch (error) {
          callbackError = toError(error)
        }

        if (isEffectActive) {
          dispose()
        } else {
          queueMicrotask(dispose)
        }

        if (callbackError) throw callbackError
      })

      isEffectActive = true

      return { unsubscribe: stop }
    },
  }
}

/**
 * Wrap a signal-like object with an {@link Observable} that suppresses
 * duplicate emissions according to a comparator.
 *
 * @typeParam T - Signal value type.
 * @param s - Signal-like source exposing a `value` property.
 * @param isEqual - Comparator that returns `true` when values are equivalent.
 * @returns Observable adapter that only emits distinct values.
 *
 * @remarks
 * The first emission is always delivered. Subsequent emissions are skipped
 * when `isEqual(previous, current)` returns `true`.
 *
 * @public
 */
export function toDistinctObservable<T>(
  s: { value: T },
  isEqual: (previous: T, current: T) => boolean,
): Observable<T> {
  const observable = toObservable(s)

  return {
    get current() {
      return observable.current
    },

    subscribe(next) {
      let hasPrevious = false
      let previous = cloneDeep(observable.current)

      return observable.subscribe((value) => {
        if (hasPrevious && isEqual(previous, value)) return

        hasPrevious = true
        previous = cloneDeep(value)
        next(value)
      })
    },

    subscribeOnce(next) {
      return observable.subscribeOnce(next)
    },
  }
}
