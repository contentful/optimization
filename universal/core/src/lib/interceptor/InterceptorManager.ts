type MaybePromise<T> = T | Promise<T>

/**
 * A function that receives a value of type T and returns a (possibly async) value of the same type T.
 * The input is readonly to discourage mutation of the original object.
 */
export type Interceptor<T> = (value: Readonly<T>) => MaybePromise<T>

/**
 * Manages a list of interceptors and provides a way to run them in sequence.
 * - Interceptors are executed in insertion order.
 */
export class InterceptorManager<T> {
  readonly #interceptors = new Map<number, Interceptor<T>>()
  #nextId = 0

  /**
   * Add an interceptor. Returns a numeric id that can be used to remove it later.
   */
  add(interceptor: Interceptor<T>): number {
    const id = this.#nextId
    this.#nextId += 1
    this.#interceptors.set(id, interceptor)
    return id
  }

  /**
   * Remove an interceptor by id. Returns true if one was removed.
   */
  remove(id: number): boolean {
    return this.#interceptors.delete(id)
  }

  /**
   * Remove all interceptors.
   */
  clear(): void {
    this.#interceptors.clear()
  }

  /**
   * How many interceptors are registered.
   */
  count(): number {
    return this.#interceptors.size
  }

  /**
   * Run all interceptors in sequence on an input value and return the final result.
   * Supports both sync and async interceptors; the return type is always Promise<T> for consistency.
   */
  async run(input: T): Promise<T> {
    // Snapshot to avoid issues if interceptors are added/removed during execution.
    const fns: ReadonlyArray<Interceptor<T>> = Array.from(this.#interceptors.values())

    let acc: T = input

    for (const fn of fns) {
      // Pass a readonly view to discourage mutation of intermediate values.
      // Each interceptor must return a T (or Promise<T>).
      acc = await fn(acc as Readonly<T>)
    }

    return acc
  }
}
