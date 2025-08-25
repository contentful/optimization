interface GuardCtx {
  method: PropertyKey
  args: unknown[]
  instance: unknown
}

interface GuardOptions<R = unknown> {
  /** If true (default), truthy guard => allow. If false, invert the check. */
  allowWhenTruthy?: boolean
  /** Methods to never guard. `constructor` and the guard method are always excluded. */
  exclude?: PropertyKey[]
  /**
   * If blocked:
   * - return this value (R),
   * - or call the provided function (method, args) => R,
   * - or call the instance method named by this key with (method, args) and return its result.
   *
   * Strings/symbols that do NOT exist as callable methods on the instance are treated as static values.
   */
  blockWith?: ((method: PropertyKey, args: unknown[]) => R) | R | PropertyKey
  /**
   * Optional side-effect when a call is blocked:
   * - call the provided function with GuardCtx,
   * - or call the instance method named by this key with GuardCtx.
   */
  onBlock?: ((ctx: GuardCtx) => void) | PropertyKey
}

function isIndexable(v: unknown): v is Record<PropertyKey, unknown> {
  return (typeof v === 'object' && v !== null) || typeof v === 'function'
}

function isFn(v: unknown): v is (this: unknown, ...a: unknown[]) => unknown {
  return typeof v === 'function'
}

function isBlockWithFn<R>(
  v: GuardOptions<R>['blockWith'],
): v is (method: PropertyKey, args: unknown[]) => R {
  return typeof v === 'function'
}

function isOnBlockFn(v: unknown): v is (ctx: GuardCtx) => void {
  return typeof v === 'function'
}

function isPropertyKey(v: unknown): v is PropertyKey {
  return typeof v === 'string' || typeof v === 'symbol' || typeof v === 'number'
}

function shouldAllow(
  self: Record<PropertyKey, unknown>,
  guardMethod: PropertyKey,
  allowWhenTruthy: boolean,
): boolean {
  const { [guardMethod]: maybeGuard } = self
  if (!isFn(maybeGuard)) {
    throw new Error(`GuardBy: "${String(guardMethod)}" is not a method on the instance.`)
  }
  const passed = Boolean(maybeGuard.call(self))
  return allowWhenTruthy ? passed : !passed
}

function runOnBlock<R>(
  self: Record<PropertyKey, unknown>,
  handler: GuardOptions<R>['onBlock'],
  method: PropertyKey,
  args: unknown[],
): void {
  if (isOnBlockFn(handler)) {
    handler({ method, args, instance: self })
    return
  }
  if (isPropertyKey(handler)) {
    const { [handler]: maybeOnBlock } = self
    if (!isFn(maybeOnBlock)) {
      throw new Error(
        `GuardBy: "onBlock" method "${String(handler)}" is not a function on the instance.`,
      )
    }
    maybeOnBlock.call(self, { method, args, instance: self })
  }
}

function computeBlockedReturn<R>(
  self: Record<PropertyKey, unknown>,
  handler: GuardOptions<R>['blockWith'],
  method: PropertyKey,
  args: unknown[],
): unknown {
  if (isBlockWithFn(handler)) {
    return handler(method, args)
  }
  if (isPropertyKey(handler)) {
    const { [handler]: maybeBW } = self
    if (isFn(maybeBW)) {
      return maybeBW.call(self, method, args)
    }
    if (Reflect.has(self, handler)) {
      throw new Error(
        `GuardBy: "blockWith" method "${String(handler)}" is not a function on the instance.`,
      )
    }
    // Not present on instance: treat as static value
    return handler
  }
  // Static value (or undefined)
  return handler
}

/**
 * Class decorator: blocks all public methods (except ctor) unless
 * the given *private* method returns an allowed value.
 *
 * NOTE: Works with TypeScript `private` methods (runtime-visible).
 * It cannot call ECMAScript `#private` methods.
 */
export function GuardBy<R = unknown>(
  guardMethod: string | symbol,
  opts: GuardOptions<R> = {},
): ClassDecorator {
  const { allowWhenTruthy = true, exclude = [], blockWith, onBlock } = opts

  return (target) => {
    const protoUnknown: unknown = (target as { prototype: unknown }).prototype
    if (!isIndexable(protoUnknown)) return
    const proto = protoUnknown // Record<PropertyKey, unknown>

    // Only exclude handler *names* that actually refer to callable prototype methods
    const extrasToSkip: PropertyKey[] = []
    const maybeAddSkip = (key: unknown): void => {
      if (!isPropertyKey(key)) return
      const candidate: unknown = proto[key]
      if (isFn(candidate)) extrasToSkip.push(key)
    }
    maybeAddSkip(blockWith)
    maybeAddSkip(onBlock)

    const toSkip = new Set<PropertyKey>(['constructor', guardMethod, ...exclude, ...extrasToSkip])

    for (const key of Reflect.ownKeys(proto)) {
      if (toSkip.has(key)) continue

      const desc = Object.getOwnPropertyDescriptor(proto, key)
      if (!desc) continue

      // Read the method directly from the prototype
      const originalUnknown: unknown = proto[key]
      if (!isFn(originalUnknown)) continue // skip non-methods and accessors
      const original = originalUnknown

      // Only destructure safe flags (avoid desc.value to keep lints happy)
      const { configurable, enumerable, writable } = desc

      const newDescriptor: PropertyDescriptor = {
        configurable,
        enumerable,
        writable,
        value: function wrappedMethod(this: Record<PropertyKey, unknown>, ...args: unknown[]) {
          const allow = shouldAllow(this, guardMethod, allowWhenTruthy)
          if (!allow) {
            runOnBlock(this, onBlock, key, args)
            return computeBlockedReturn(this, blockWith, key, args)
          }
          return original.apply(this, args)
        },
      }

      Object.defineProperty(proto, key, newDescriptor)
    }
  }
}
