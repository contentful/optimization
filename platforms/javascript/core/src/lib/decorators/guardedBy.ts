type BlockHandler = (methodName: string, args: readonly unknown[]) => void

export interface GuardedByOptions<T extends object> {
  /** If true, block when predicate is truthy; otherwise allow when truthy. */
  readonly invert?: boolean

  /**
   * Either a function, or the name/symbol of an instance method to call when blocked.
   * Both predicate and onBlocked are synchronous and receive (methodName, argsArray).
   */
  readonly onBlocked?: BlockHandler | (keyof T & (string | symbol))
}

const isFunction = (v: unknown): v is (...args: readonly unknown[]) => unknown =>
  typeof v === 'function'

const nameToString = (name: PropertyKey): string =>
  typeof name === 'string'
    ? name
    : typeof name === 'symbol'
      ? (name.description ?? String(name))
      : String(name)

/** True when the onBlocked option is a property key (string or symbol). */
const isOnBlockedKey = <T extends object>(
  v: GuardedByOptions<T>['onBlocked'],
): v is keyof T & (string | symbol) => typeof v === 'string' || typeof v === 'symbol'

/** Detect declared `async` functions. */
const isAsyncFunction = (fn: (...args: readonly unknown[]) => unknown): boolean =>
  Object.prototype.toString.call(fn) === '[object AsyncFunction]'

/**
 * Methods-only decorator (blocks silently):
 * - When blocked, runs onBlocked (if provided) and returns `undefined`
 *   — or `Promise<undefined>` if the original method is async.
 * - If the predicate is missing/misconfigured, throws TypeError.
 *
 * IMPORTANT: The returned decorator is generic over the concrete method type:
 *   <A, R>(value: (...args: A) => R, context: ClassMethodDecoratorContext<T, (...args: A) => R>) => void
 */
export function guardedBy<T extends object>(
  predicateName: keyof T & (string | symbol),
  opts?: GuardedByOptions<T>,
): <A extends readonly unknown[], R>(
  value: (...args: A) => R,
  context: ClassMethodDecoratorContext<T, (...args: A) => R>,
) => void {
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
