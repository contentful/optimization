type BlockHandler = (methodName: string, args: readonly unknown[]) => void

export interface GuardedByOptions<T extends object> {
  readonly invert?: boolean
  readonly onBlocked?: BlockHandler | (keyof T & (string | symbol))
}

export class GuardedByBlockedError extends Error {
  constructor(methodName: string) {
    super(`Call to "${methodName}" was blocked by @guardedBy predicate.`)
    this.name = 'GuardedByBlockedError'
  }
}

const isFunction = (v: unknown): v is (...args: readonly unknown[]) => unknown =>
  typeof v === 'function'

const nameToString = (name: PropertyKey): string =>
  typeof name === 'string'
    ? name
    : typeof name === 'symbol'
      ? (name.description ?? String(name))
      : String(name)

const isOnBlockedKey = <T extends object>(
  v: GuardedByOptions<T>['onBlocked'],
): v is keyof T & (string | symbol) => typeof v === 'string' || typeof v === 'symbol'

/**
 * Methods-only decorator:
 * - Generic over concrete method type (params A, return R).
 * - Returns a replacement with the exact same type `(this: T, ...A) => R`.
 * - Predicate/onBlocked are synchronous and receive (methodName, argsArray).
 */
export function guardedBy<T extends object>(
  predicateName: keyof T & (string | symbol),
  opts?: GuardedByOptions<T>,
): <A extends readonly unknown[], R>(
  value: (this: T, ...args: A) => R,
  context: ClassMethodDecoratorContext<T, (this: T, ...args: A) => R>,
) => (this: T, ...args: A) => R {
  return function <A extends readonly unknown[], R>(
    value: (this: T, ...args: A) => R,
    context: ClassMethodDecoratorContext<T, (this: T, ...args: A) => R>,
  ): (this: T, ...args: A) => R {
    const decoratedName = nameToString(context.name)

    const wrapped: (this: T, ...args: A) => R = function (this: T, ...args: A): R {
      // Get predicate from instance (computed destructuring)
      const { [predicateName]: candPredicate } = this
      if (!isFunction(candPredicate)) {
        throw new TypeError(
          `@guardedBy expects predicate "${String(predicateName)}" to be a synchronous function.`,
        )
      }

      // IMPORTANT: bind the instance for class predicates
      const ok = Boolean(candPredicate.call(this, decoratedName, args))
      const allowed = opts?.invert === true ? !ok : ok

      if (!allowed) {
        const { onBlocked } = opts ?? {}
        if (onBlocked !== undefined) {
          if (isFunction(onBlocked)) {
            // Bind the instance for inline onBlocked too
            onBlocked.call(this, decoratedName, args)
          } else if (isOnBlockedKey<T>(onBlocked)) {
            const { [onBlocked]: handlerCandidate } = this
            if (isFunction(handlerCandidate)) {
              // Bind the instance for named class handlers
              handlerCandidate.call(this, decoratedName, args)
            }
          }
        }
        throw new GuardedByBlockedError(decoratedName)
      }

      return value.call(this, ...args)
    }

    return wrapped
  }
}
