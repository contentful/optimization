import { effect } from '@preact/signals-core'
import { cloneDeep } from 'es-toolkit'

/**
 * Disposable handle returned by observable subscriptions.
 *
 * @public
 */
export interface Subscription {
  /** Stop receiving subsequent emissions for the subscription. */
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
   * Snapshot of the current signal value.
   *
   * @remarks
   * Core state observables return deep-cloned snapshots by default to prevent accidental in-place
   * mutations from leaking back into internal signal state. High-volume event-stream observables may
   * return immutable event references to avoid cloning large Contentful entry graphs.
   */
  readonly current: T
  /**
   * Subscribe to all value updates (including the current value immediately).
   *
   * @param next - Callback invoked for each emitted value snapshot.
   * @returns A {@link Subscription} used to stop observing updates.
   *
   * @remarks
   * Core state observable values are deep-cloned before being passed to `next` by default.
   * High-volume event streams may pass immutable event references.
   */
  subscribe: (next: (v: T) => void) => Subscription
  /**
   * Subscribe to the first non-nullish value, then auto-unsubscribe.
   *
   * @param next - Callback invoked exactly once with the first non-nullish value.
   * @returns A {@link Subscription} that can cancel before the first emission.
   *
   * @remarks
   * Core state observable values are deep-cloned before being passed to `next` by default.
   * High-volume event streams may pass immutable event references.
   */
  subscribeOnce: (next: (v: NonNullable<T>) => void) => Subscription
}

function isNonNullish<TValue>(value: TValue): value is NonNullable<TValue> {
  return value !== undefined && value !== null
}

const NOOP_SUBSCRIPTION: Subscription = { unsubscribe: () => undefined }

/**
 * Create an {@link Observable} over a fixed value that never changes.
 *
 * @typeParam T - Value type emitted by the observable.
 * @param value - The constant value exposed as `current` and emitted on subscribe.
 * @returns An observable that emits `value` once on subscribe and never again.
 *
 * @public
 */
export function staticObservable<T>(value: T): Observable<T> {
  return {
    current: value,

    subscribe(next) {
      next(value)
      return NOOP_SUBSCRIPTION
    },

    subscribeOnce(next) {
      if (isNonNullish(value)) next(value)
      return NOOP_SUBSCRIPTION
    },
  }
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value
  return new Error(`Subscriber threw non-Error value: ${String(value)}`)
}

type SnapshotFn<T> = (value: T) => T

/**
 * Wrap a signal-like object with the local {@link Observable} contract.
 *
 * @typeParam T - Signal value type.
 * @param s - Signal-like source exposing a `value` property.
 * @param snapshot - Optional snapshot function. Defaults to deep-cloning values.
 * @returns Observable adapter for the given signal source.
 *
 * @remarks
 * Emitted values and `current` snapshots are deep-cloned by default to isolate
 * subscriber-side mutation from internal Core state. Pass an identity snapshot
 * only for event streams where values are immutable SDK emissions and may
 * contain large Contentful entry graphs.
 *
 * @public
 */
export function toObservable<T>(
  s: { value: T },
  snapshot: SnapshotFn<T> = cloneDeep as SnapshotFn<T>,
): Observable<T> {
  return {
    get current() {
      return snapshot(s.value)
    },

    subscribe(next) {
      const dispose = effect(() => {
        next(snapshot(s.value))
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
          const snapshotValue = snapshot(value)
          if (!isNonNullish(snapshotValue)) return
          next(snapshotValue)
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
