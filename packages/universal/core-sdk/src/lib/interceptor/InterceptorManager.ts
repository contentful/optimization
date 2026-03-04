/**
 * A utility type representing a value that may be synchronously available or
 * produced asynchronously.
 *
 * @typeParam T - The resolved value type.
 * @public
 */
type MaybePromise<T> = T | Promise<T>

/**
 * A function that receives a value of type `T` and returns a (possibly async)
 * value of the same type `T`. The input is marked as `readonly` to discourage
 * mutation of the original object.
 *
 * @typeParam T - The value type intercepted and returned.
 * @param value - The current (readonly) value in the interception chain.
 * @returns The next value for the chain, either directly or via a promise.
 * @remarks Implementations SHOULD avoid mutating `value` and instead return a
 * new or safely-updated instance.
 * @see {@link InterceptorManager}
 * @public
 */
export type Interceptor<T> = (value: Readonly<T>) => MaybePromise<T>

/**
 * Manages a list of interceptors and provides a way to run them in sequence.
 *
 * Interceptors are executed in insertion order. Each interceptor receives the
 * result of the previous interceptor (or the initial input for the first one)
 * and may return a new value synchronously or asynchronously.
 *
 * @typeParam T - The value type processed by the interceptors.
 * @remarks This class snapshots the current interceptor list at invocation time
 * so additions/removals during `run` do not affect the in-flight execution.
 * @example
 * ```ts
 * const mgr = new InterceptorManager<number>();
 * const id = mgr.add((n) => n + 1);
 * const final = await mgr.run(1); // 2
 * mgr.remove(id);
 * ```
 * @public
 */
export class InterceptorManager<T> {
  /**
   * The registry of interceptors keyed by their insertion id.
   *
   * @privateRemarks Internal storage; use {@link add}, {@link remove}, and
   * {@link clear} to manage contents.
   * @readonly
   * @defaultValue `new Map()`
   */
  private readonly interceptors = new Map<number, Interceptor<T>>()

  /**
   * The next numeric id to assign to an added interceptor.
   *
   * @privateRemarks Used only to generate unique, monotonically increasing ids.
   * @defaultValue `0`
   */
  private nextId = 0

  /**
   * Add an interceptor and return its identifier.
   *
   * @param interceptor - The interceptor function to register.
   * @returns The numeric id that can later be used with {@link remove}.
   * @remarks Interceptors are executed in the order they are added.
   * @example
   * ```ts
   * const id = manager.add(async (value) => transform(value));
   * ```
   * @public
   */
  add(interceptor: Interceptor<T>): number {
    const { nextId: id } = this
    this.nextId += 1
    this.interceptors.set(id, interceptor)
    return id
  }

  /**
   * Remove an interceptor by its identifier.
   *
   * @param id - The id previously returned by {@link add}.
   * @returns `true` if an interceptor was removed; otherwise `false`.
   * @example
   * ```ts
   * const removed = manager.remove(id);
   * ```
   * @public
   */
  remove(id: number): boolean {
    return this.interceptors.delete(id)
  }

  /**
   * Remove all registered interceptors.
   *
   * @returns Nothing.
   * @remarks After calling this, {@link count} will return `0`.
   * @example
   * ```ts
   * manager.clear();
   * ```
   * @public
   */
  clear(): void {
    this.interceptors.clear()
  }

  /**
   * Get the number of currently registered interceptors.
   *
   * @returns The count of interceptors.
   * @example
   * ```ts
   * if (manager.count() === 0) { /* ... *\/ }
   * ```
   * @public
   */
  count(): number {
    return this.interceptors.size
  }

  /**
   * Run all interceptors in sequence on an input value and return the final result.
   *
   * Supports both sync and async interceptors; the return type is always `Promise<T>`
   * for consistency.
   *
   * @param input - The initial value to pass to the first interceptor.
   * @returns A promise resolving to the final value after all interceptors have run.
   * @throws May rethrow any error thrown by an interceptor. <!-- Intentionally vague: error type depends on interceptor implementation -->
   * @remarks The interceptor list is snapshotted at invocation time; changes to
   * the registry during execution do not affect the running sequence.
   * @example
   * ```ts
   * const result = await manager.run(initial);
   * ```
   * @public
   */
  async run(input: T): Promise<T> {
    // Snapshot to avoid issues if interceptors are added/removed during execution.
    const fns: ReadonlyArray<Interceptor<T>> = Array.from(this.interceptors.values())

    let acc: T = input

    for (const fn of fns) {
      // Pass a readonly view to discourage mutation of intermediate values.
      // Each interceptor must return a T (or Promise<T>).
      acc = await fn(acc as Readonly<T>)
    }

    return acc
  }
}
