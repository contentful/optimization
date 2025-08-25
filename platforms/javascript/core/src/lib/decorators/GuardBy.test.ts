import { describe, it, expect, vi } from 'vitest'
import { GuardBy } from './GuardBy'

function isObjectLike(v: unknown): v is object {
  return (typeof v === 'object' && v !== null) || typeof v === 'function'
}

function hasFunctionKey<T extends object, K extends PropertyKey>(
  obj: T,
  key: K,
): obj is T & Record<K, (...args: unknown[]) => unknown> {
  return typeof Reflect.get(obj, key) === 'function'
}

describe('GuardBy', () => {
  it('blocks public methods when guard returns false and calls onBlock (function) and guard', () => {
    const onBlock = vi.fn()

    @GuardBy('canRun', { onBlock })
    class Service {
      private readonly enabled = false

      // @ts-expect-error -- used in test
      private canRun(): boolean {
        return this.enabled
      }

      public count = 0

      public doWork(a: number): number {
        this.count += a
        return this.count
      }
    }

    const s = new Service()

    const protoUnknown = Object.getPrototypeOf(s)
    if (!isObjectLike(protoUnknown)) throw new Error('Prototype is not an object')
    const proto = protoUnknown
    if (!hasFunctionKey(proto, 'canRun')) throw new Error('Missing canRun')
    const guardSpy = vi.spyOn(proto, 'canRun')

    const result = s.doWork(5)
    expect(result).toBeUndefined() // blocked
    expect(s.count).toBe(0) // original not executed
    expect(guardSpy).toHaveBeenCalledTimes(1)

    expect(onBlock).toHaveBeenCalledTimes(1)
    expect(onBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'doWork',
        args: [5],
        instance: s,
      }),
    )
  })

  it('allows public methods when guard becomes true; excluded methods always run', () => {
    const onBlock = vi.fn()

    @GuardBy('canRun', { exclude: ['enable'], onBlock })
    class Service {
      private enabled = false

      // @ts-expect-error -- used in test
      private canRun(): boolean {
        return this.enabled
      }

      public enable(): void {
        this.enabled = true
      }

      public doWork(): string {
        return 'ok'
      }
    }

    const s = new Service()
    expect(s.doWork()).toBeUndefined() // blocked initially

    s.enable() // excluded -> runs while blocked
    expect(s.doWork()).toBe('ok') // now allowed

    expect(onBlock).toHaveBeenCalledTimes(1)
  })

  it('inverts logic when allowWhenTruthy is false', () => {
    @GuardBy('canRun', { allowWhenTruthy: false })
    class S {
      // @ts-expect-error -- used in test
      private canRun(): boolean {
        return true
      } // truthy -> should block when inverted

      public go(): number {
        return 1
      }
    }

    const s = new S()
    expect(s.go()).toBeUndefined()
  })

  it('returns a static blockWith value when blocked', () => {
    @GuardBy('canRun', { blockWith: 'BLOCKED' })
    class S {
      // @ts-expect-error -- used in test
      private canRun(): boolean {
        return false
      }
      public go(): string {
        return 'allowed'
      }
    }

    const s = new S()
    expect(s.go()).toBe('BLOCKED')
  })

  it('invokes a blockWith function (method, args) when blocked', () => {
    const blockWith = vi.fn((method: PropertyKey, args: unknown[]) => ({
      method,
      argsLen: args.length,
    }))

    @GuardBy('canRun', { blockWith })
    class S {
      // @ts-expect-error -- used in test
      private canRun(): boolean {
        return false
      }
      public sum(a: number, b: number): number {
        return a + b
      }
    }

    const s = new S()
    const out = s.sum(2, 3)

    expect(blockWith).toHaveBeenCalledTimes(1)
    expect(blockWith).toHaveBeenCalledWith('sum', [2, 3])
    expect(out).toEqual({ method: 'sum', argsLen: 2 })
  })

  it('supports blockWith and onBlock as method names; they can access instance state and are excluded from guarding', () => {
    @GuardBy('canRun', { blockWith: 'handleBlock', onBlock: 'onBlocked' })
    class S {
      private readonly enabled = false
      // @ts-expect-error -- used in test
      private canRun(): boolean {
        return this.enabled
      } // false -> calls blocked path

      public value = 10
      public events: PropertyKey[] = []

      // Both should be excluded from guard wrapping
      public handleBlock(method: PropertyKey, _args: unknown[]): Record<string, unknown> {
        this.value += 1 // access instance state
        return { method, value: this.value }
      }

      public onBlocked(ctx: { method: PropertyKey; args: unknown[]; instance: unknown }): void {
        this.events.push(ctx.method)
      }

      public work(n: number): number {
        return n * 2
      }
    }

    const s = new S()

    // Spy on prototype methods by narrowing before spying
    const protoUnknown = Object.getPrototypeOf(s)
    if (!isObjectLike(protoUnknown)) throw new Error('Prototype is not an object')
    const proto = protoUnknown

    if (!hasFunctionKey(proto, 'handleBlock')) throw new Error('Missing handleBlock')
    if (!hasFunctionKey(proto, 'onBlocked')) throw new Error('Missing onBlocked')
    const bwSpy = vi.spyOn(proto, 'handleBlock')
    const obSpy = vi.spyOn(proto, 'onBlocked')

    const out = s.work(7)

    // blockWith method was called and returned its computed result
    expect(bwSpy).toHaveBeenCalledTimes(1)
    expect(bwSpy).toHaveBeenCalledWith('work', [7])
    expect(out).toEqual({ method: 'work', value: 11 }) // value incremented in handleBlock

    // onBlock method was invoked and could push into events
    expect(obSpy).toHaveBeenCalledTimes(1)
    expect(s.events).toEqual(['work'])

    // The named handler methods themselves are callable directly (not guarded)
    expect(s.handleBlock('X', [])).toEqual({ method: 'X', value: 12 })
  })

  it('throws a clear error if blockWith method name is not a function', () => {
    @GuardBy('canRun', { blockWith: 'notAFunction' })
    class S {
      // @ts-expect-error -- used in test
      private canRun(): boolean {
        return false
      }

      public notAFunction = 'nope'

      public go(): string {
        return 'x'
      }
    }

    const s = new S()
    expect(() => s.go()).toThrow(/"blockWith" method "notAFunction" is not a function/)
  })

  it('throws a clear error if onBlock method name is not a function', () => {
    @GuardBy('canRun', { onBlock: 'notAFunction' })
    class S {
      // @ts-expect-error -- used in test
      private canRun(): boolean {
        return false
      }

      public notAFunction = 123

      public go(): string {
        return 'x'
      }
    }

    const s = new S()
    // It blocks, tries to run onBlock -> error
    expect(() => s.go()).toThrow(/"onBlock" method "notAFunction" is not a function/)
  })

  it('does not wrap getters/setters', () => {
    @GuardBy('canRun')
    class S {
      // @ts-expect-error -- used in test
      private canRun(): boolean {
        return false
      }

      private _v = 10

      get value(): number {
        return this._v
      }

      set value(v: number) {
        this._v = v
      }
    }

    const s = new S()
    expect(s.value).toBe(10)
    s.value = 42
    expect(s.value).toBe(42)
  })

  it('supports async public methods (allowed path)', async () => {
    @GuardBy('canRun')
    class S {
      // @ts-expect-error -- used in test
      private canRun(): boolean {
        return true
      }

      public async fetch(): Promise<number> {
        await Promise.resolve()
        return 42
      }
    }

    const s = new S()
    await expect(s.fetch()).resolves.toBe(42)
  })

  it('handles symbol-named guard methods', () => {
    const sym = Symbol('can')

    @GuardBy(sym)
    class S {
      // @ts-expect-error -- used in test
      private [sym](): boolean {
        return true
      } // TS private (not #private)

      public go(): string {
        return 'ok'
      }
    }

    const s = new S()
    expect(s.go()).toBe('ok')
  })
})
