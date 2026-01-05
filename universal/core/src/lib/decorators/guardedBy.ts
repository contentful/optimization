/**
 * A callback invoked when a method call is blocked by {@link guardedBy}.
 *
 * @param methodName - The name of the method that was attempted.
 * @param args - The readonly array of arguments supplied to the blocked call.
 * @returns Nothing.
 *
 * @public
 */
type BlockHandler = (methodName: string, args: readonly unknown[]) => void

/**
 * The original method implementation.
 *
 * @typeParam A - The parameter tuple of the original method.
 * @typeParam R - The return type of the original method.
 * @param value - The method being decorated.
 * @param context - The Stage-3 decorator context for a class method.
 * @returns Nothing.
 *
 * @remarks
 * Users do not call this directly; it's returned by {@link guardedBy}.
 */
type GuardedByFunction<T extends object> = <A extends readonly unknown[], R>(
  value: (...args: A) => R,
  context: ClassMethodDecoratorContext<T, (...args: A) => R>,
) => void

/**
 * Options that tweak the behavior of {@link guardedBy}.
 *
 * @typeParam T - The instance type on which the decorator is applied.
 *
 * @public
 */
export interface GuardedByOptions<T extends object> {
  /**
   * Inverts the predicate result.
   *
   * When `true`, a truthy predicate result **blocks** the method.
   * When `false` (default) or omitted, a truthy predicate result **allows** the method.
   *
   * @defaultValue `false`
   * @remarks
   * This option is useful when the predicate expresses a *forbid* condition
   * (e.g. "isLocked" or "isDestroyed") rather than an *allow* condition.
   */
  readonly invert?: boolean

  /**
   * Either a function to call when a method is blocked, or the name/symbol of
   * an instance method on `this` to call when blocked.
   *
   * Both forms are **synchronous** and receive `(methodName, argsArray)`.
   * If omitted, blocked calls fail silently (i.e., return `undefined` or
   * `Promise<undefined>` for async methods).
   *
   * @remarks
   * - If a property key is supplied and the instance does not have a callable at that key,
   *   the hook is ignored.
   * - The hook **must not** be `async`; any async work should be scheduled manually.
   */
  readonly onBlocked?: BlockHandler | (keyof T & (string | symbol))
}

/**
 * Type guard for functions.
 *
 * @internal
 */
const isFunction = (v: unknown): v is (...args: readonly unknown[]) => unknown =>
  typeof v === 'function'

/**
 * Converts a property key to a readable string for logs and messages.
 *
 * @param name - The property key to stringify.
 * @returns A human-friendly name.
 *
 * @internal
 */
const nameToString = (name: PropertyKey): string =>
  typeof name === 'string'
    ? name
    : typeof name === 'symbol'
      ? (name.description ?? String(name))
      : String(name)

/**
 * True when the `onBlocked` option is a property key (string or symbol).
 *
 * @typeParam T - The instance type.
 * @param v - The `onBlocked` option value.
 * @returns Whether `v` is a property key.
 *
 * @internal
 */
const isOnBlockedKey = <T extends object>(
  v: GuardedByOptions<T>['onBlocked'],
): v is keyof T & (string | symbol) => typeof v === 'string' || typeof v === 'symbol'

/**
 * Detects declared `async` functions.
 *
 * @param fn - The candidate to test.
 * @returns `true` if `fn` is an async function, else `false`.
 *
 * @internal
 */
const isAsyncFunction = (fn: (...args: readonly unknown[]) => unknown): boolean =>
  Object.prototype.toString.call(fn) === '[object AsyncFunction]'

/**
 * Decorator factory that **guards** class methods behind a synchronous predicate.
 *
 * When a decorated method is invoked:
 * - If the predicate returns a value that evaluates to **allowed** (see `invert`), the original
 *   method is executed and its result is returned.
 * - If the call is **blocked**, the optional `onBlocked` hook is invoked (if configured) and:
 *   - `undefined` is returned for sync methods; or
 *   - `Promise<undefined>` is returned for async methods (to preserve `await` compatibility).
 *
 * @typeParam T - The instance type that owns both the predicate and the decorated method.
 *
 * @param predicateName - The name (string or symbol) of a **synchronous** instance method on `this`
 * that acts as the predicate. It is called as `this[predicateName](methodName, argsArray)`.
 * @param opts - Optional {@link GuardedByOptions | options} to configure inversion and `onBlocked`.
 *
 * @returns A methods-only class decorator compatible with Stage-3 decorators that wraps the method.
 *
 * @throws TypeError
 * Thrown at initialization time (first instance construction) if `predicateName` does not resolve
 * to a **synchronous function** on the instance.
 *
 * @remarks
 * - This is a **methods-only** decorator; applying it to accessors/fields is a no-op.
 * - The decorator preserves the original method's sync/async shape.
 * - The predicate is invoked with `(decoratedMethodName, argsArray)` to support context-aware checks.
 *
 * @example
 * Here, `canRun` allows the call when it returns truthy:
 * ```ts
 * class Runner {
 *   canRun(method: string, _args: readonly unknown[]) { return method !== 'stop'; }
 *
 *   @guardedBy<Runner>('canRun')
 *   go() { console.log('running'); }
 * }
 * ```
 *
 * @example
 * Invert the predicate and call a handler on block:
 * ```ts
 * class Door {
 *   isLocked() { return true } // truthy means "locked"
 *   onBlocked(method: string) { console.warn(`${method} blocked`) }
 *
 *   @guardedBy<Door>('isLocked', { invert: true, onBlocked: 'onBlocked' })
 *   open() { /* ... *\/ }
 * }
 * ```
 *
 * @public
 */
export function guardedBy<T extends object>(
  predicateName: keyof T & (string | symbol),
  opts?: GuardedByOptions<T>,
): GuardedByFunction<T> {
  return function <A extends readonly unknown[], R>(
    _value: (...args: A) => R,
    context: ClassMethodDecoratorContext<T, (...args: A) => R>,
  ): void {
    const decoratedName = nameToString(context.name)

    context.addInitializer(function init(this: T): void {
      // Original method on the instance
      const originalUnknown: unknown = Reflect.get(this, context.name)
      if (!isFunction(originalUnknown)) {
        return // defensive: nothing to wrap
      }
      const original = originalUnknown
      const originalIsAsync = isAsyncFunction(original)

      const resolvePredicate = (self: T): ((...args: readonly unknown[]) => unknown) => {
        const { [predicateName]: cand } = self
        if (!isFunction(cand)) {
          throw new TypeError(
            `@guardedBy expects predicate "${String(predicateName)}" to be a synchronous function.`,
          )
        }
        return cand
      }

      const computeAllowed = (self: T, args: readonly unknown[]): boolean => {
        const pred = resolvePredicate(self)
        const ok = Boolean(pred.call(self, decoratedName, args))
        return opts?.invert === true ? !ok : ok
      }

      const runOnBlocked = (self: T, args: readonly unknown[]): void => {
        const { onBlocked } = opts ?? {}
        if (onBlocked === undefined) {
          return
        }
        if (isFunction(onBlocked)) {
          onBlocked.call(self, decoratedName, args)
          return
        }
        if (isOnBlockedKey<T>(onBlocked)) {
          const { [onBlocked]: handlerCandidate } = self
          if (isFunction(handlerCandidate)) {
            handlerCandidate.call(self, decoratedName, args)
          }
        }
      }

      const blockedReturn = (): unknown =>
        originalIsAsync ? Promise.resolve(undefined) : undefined

      const wrapped = function (this: T, ...args: readonly unknown[]): unknown {
        if (!computeAllowed(this, args)) {
          runOnBlocked(this, args)
          return blockedReturn()
        }
        return original.call(this, ...args)
      }

      // Replace the instance method with our wrapper
      Reflect.set(this, context.name, wrapped)
    })
  }
}
