interface GuardCtx {
  method: PropertyKey
  args: unknown[]
  instance: unknown
}

interface GuardOptions {
  allowWhenTruthy?: boolean
  exclude?: PropertyKey[]
  blockWith?: (method: PropertyKey, args: unknown[]) => unknown
  onBlock?: (ctx: GuardCtx) => void
}

const isObjectLike = (v: unknown): v is object =>
  (typeof v === 'object' && v !== null) || typeof v === 'function'

const isFn = (v: unknown): v is (this: unknown, ...a: unknown[]) => unknown =>
  typeof v === 'function'

export function Guard(guardMethod: string | symbol, opts: GuardOptions = {}): ClassDecorator {
  const { allowWhenTruthy = true, exclude = [], blockWith, onBlock } = opts

  return (target) => {
    const protoUnknown: unknown = (target as { prototype: unknown }).prototype
    if (!isObjectLike(protoUnknown)) return
    const proto: object = protoUnknown

    const toSkip = new Set<PropertyKey>(['constructor', guardMethod, ...exclude])

    for (const key of Reflect.ownKeys(proto)) {
      if (toSkip.has(key)) continue

      const desc = Object.getOwnPropertyDescriptor(proto, key)
      if (!desc) continue

      const rawValue: unknown = desc.value
      if (!isFn(rawValue)) continue

      const original: (this: unknown, ...a: unknown[]) => unknown = rawValue

      Object.defineProperty(proto, key, {
        ...desc,
        value: function wrappedMethod(this: Record<PropertyKey, unknown>, ...args: unknown[]) {
          const { [guardMethod]: maybeGuard } = this

          if (!isFn(maybeGuard)) {
            throw new Error(`GuardBy: "${String(guardMethod)}" is not a method on the instance.`)
          }

          const passed = Boolean(maybeGuard.call(this))
          const allow = allowWhenTruthy ? passed : !passed

          if (!allow) {
            onBlock?.({ method: key, args, instance: this })
            return typeof blockWith === 'function' ? blockWith(key, args) : blockWith
          }

          return original.apply(this, args)
        },
      })
    }
  }
}
