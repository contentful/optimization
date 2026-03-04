import { guardedBy } from './guardedBy'

const inlineOnBlockedSpy = rs.fn<(name: string, args: readonly unknown[]) => void>()

describe('guardedBy (methods only, sync predicate/onBlocked, silent block)', () => {
  beforeEach((): void => {
    rs.clearAllMocks()
  })

  const ON_BLOCKED_SYM: unique symbol = Symbol('onBlockedSym')

  class Fixture {
    public enabled = false

    // Synchronous predicate: (methodName, argsArray) -> boolean
    public gate(name: string, args: readonly unknown[]): boolean {
      return this.enabled && name.length > 0 && args.length > 0
    }

    // Named onBlocked (string key)
    public handleBlocked(name: string, args: readonly unknown[]): void {
      void name
      void args
    }

    // Named onBlocked (symbol key)
    public [ON_BLOCKED_SYM](name: string, args: readonly unknown[]): void {
      void name
      void args
    }

    // Non-function property to exercise the “named but not callable” path
    public notFunc: unknown = 42

    // ---- Decorated methods (no fields / no arrow functions) ----

    // 1) Basic gating (no onBlocked)
    @guardedBy<Fixture>('gate')
    public doWork(id: string): string {
      return `ok:${id}`
    }

    // 2) Inverted logic
    @guardedBy<Fixture>('gate', { invert: true })
    public doWorkInverted(id: string): string {
      return `ok:${id}`
    }

    // 3) Named onBlocked (string key)
    @guardedBy<Fixture>('gate', { onBlocked: 'handleBlocked' })
    public withNamedHandler(id: string): string {
      return `ok:${id}`
    }

    // 4) Named onBlocked (symbol key)
    @guardedBy<Fixture>('gate', { onBlocked: ON_BLOCKED_SYM })
    public withSymbolHandler(id: string): string {
      return `ok:${id}`
    }

    // 5) Inline onBlocked (external spy)
    @guardedBy<Fixture>('gate', {
      onBlocked(name, args) {
        inlineOnBlockedSpy(name, args)
      },
    })
    public withInlineHandler(id: string): string {
      return `ok:${id}`
    }

    // 6) Named onBlocked exists but is NOT a function (ignored, still blocks)
    @guardedBy<Fixture>('gate', { onBlocked: 'notFunc' })
    public withNonFunctionHandler(id: string): string {
      return `ok:${id}`
    }

    // 7) Async method (allowed; blocked resolves to Promise<undefined>)
    @guardedBy<Fixture>('gate')
    public async doAsync(id: string): Promise<string> {
      const msg = await Promise.resolve(`ok:${id}`)
      return msg
    }
  }

  // Separate fixture: misconfigured predicate (non-function) throws TypeError on call
  class BadFixture {
    public notFunc: unknown = 42

    @guardedBy<BadFixture>('notFunc')
    public willThrow(id: string): string {
      return id
    }
  }

  it('calls the original method when predicate allows', (): void => {
    const fx = new Fixture()
    fx.enabled = true

    const gateSpy = rs.spyOn(fx, 'gate')
    const result = fx.doWork('A')

    expect(result).toBe('ok:A')
    expect(gateSpy).toHaveBeenCalledTimes(1)
    expect(gateSpy).toHaveBeenCalledWith('doWork', ['A'])
  })

  it('returns undefined when blocked and no onBlocked', (): void => {
    const fx = new Fixture()
    fx.enabled = false

    const gateSpy = rs.spyOn(fx, 'gate')
    const result = fx.doWork('B')

    expect(result).toBeUndefined()
    expect(gateSpy).toHaveBeenCalledTimes(1)
    expect(gateSpy).toHaveBeenCalledWith('doWork', ['B'])
  })

  it('inverts the predicate when invert=true', (): void => {
    const fx = new Fixture()

    fx.enabled = true // predicate true -> inverted => blocked
    const blocked = fx.doWorkInverted('C')
    expect(blocked).toBeUndefined()

    fx.enabled = false // predicate false -> inverted => allowed
    const ok = fx.doWorkInverted('D')
    expect(ok).toBe('ok:D')
  })

  it('invokes named onBlocked (string key) when blocked, then returns undefined', (): void => {
    const fx = new Fixture()
    fx.enabled = false

    const gateSpy = rs.spyOn(fx, 'gate')
    const handlerSpy = rs.spyOn(fx, 'handleBlocked')

    const result = fx.withNamedHandler('E')
    expect(result).toBeUndefined()

    expect(gateSpy).toHaveBeenCalledTimes(1)
    expect(gateSpy).toHaveBeenCalledWith('withNamedHandler', ['E'])
    expect(handlerSpy).toHaveBeenCalledTimes(1)
    expect(handlerSpy).toHaveBeenCalledWith('withNamedHandler', ['E'])
  })

  it('invokes named onBlocked (symbol key) when blocked, then returns undefined', (): void => {
    const fx = new Fixture()
    fx.enabled = false

    const gateSpy = rs.spyOn(fx, 'gate')
    const symHandlerSpy = rs.fn<(name: string, args: readonly unknown[]) => void>()
    fx[ON_BLOCKED_SYM] = symHandlerSpy

    const result = fx.withSymbolHandler('S')
    expect(result).toBeUndefined()

    expect(gateSpy).toHaveBeenCalledTimes(1)
    expect(gateSpy).toHaveBeenCalledWith('withSymbolHandler', ['S'])
    expect(symHandlerSpy).toHaveBeenCalledTimes(1)
    expect(symHandlerSpy).toHaveBeenCalledWith('withSymbolHandler', ['S'])
  })

  it('invokes inline onBlocked when blocked, then returns undefined', (): void => {
    const fx = new Fixture()
    fx.enabled = false

    const gateSpy = rs.spyOn(fx, 'gate')

    const result = fx.withInlineHandler('F')
    expect(result).toBeUndefined()

    expect(gateSpy).toHaveBeenCalledTimes(1)
    expect(gateSpy).toHaveBeenCalledWith('withInlineHandler', ['F'])
    expect(inlineOnBlockedSpy).toHaveBeenCalledTimes(1)
    expect(inlineOnBlockedSpy).toHaveBeenCalledWith('withInlineHandler', ['F'])
  })

  it('ignores named onBlocked when the property is not a function, still returns undefined', (): void => {
    const fx = new Fixture()
    fx.enabled = false

    const gateSpy = rs.spyOn(fx, 'gate')
    const result = fx.withNonFunctionHandler('N')

    expect(result).toBeUndefined()
    expect(gateSpy).toHaveBeenCalledTimes(1)
    expect(gateSpy).toHaveBeenCalledWith('withNonFunctionHandler', ['N'])
  })

  it('supports decorating async methods: blocked resolves to undefined; allowed resolves to value', async (): Promise<void> => {
    const fx = new Fixture()
    const gateSpy = rs.spyOn(fx, 'gate')

    // Blocked: resolves to undefined
    fx.enabled = false
    const blocked = await fx.doAsync('X')
    expect(blocked).toBeUndefined()

    // Allowed: resolves normally
    fx.enabled = true
    const val = await fx.doAsync('Y')
    expect(val).toBe('ok:Y')

    // Both calls counted
    expect(gateSpy).toHaveBeenCalledTimes(2)
    expect(gateSpy).toHaveBeenNthCalledWith(1, 'doAsync', ['X'])
    expect(gateSpy).toHaveBeenNthCalledWith(2, 'doAsync', ['Y'])
  })

  it('throws a TypeError when the predicate key is not a function (on call)', (): void => {
    const bad = new BadFixture()
    expect(() => bad.willThrow('Z')).toThrow(TypeError)
  })

  it('handles symbol-named methods (covers nameToString non-string branch)', (): void => {
    const METHOD_SYM: unique symbol = Symbol('symMethod')

    class SymFixture {
      public enabled = true

      public gate(name: string, args: readonly unknown[]): boolean {
        return name === 'symMethod' && args.length === 1
      }

      @guardedBy<SymFixture>('gate')
      public [METHOD_SYM](id: string): string {
        return `ok:${id}`
      }
    }

    const fx = new SymFixture()
    const gateSpy = rs.spyOn(fx, 'gate')

    const result = fx[METHOD_SYM]('Z')
    expect(result).toBe('ok:Z')

    expect(gateSpy).toHaveBeenCalledTimes(1)
    expect(gateSpy).toHaveBeenCalledWith('symMethod', ['Z'])
  })

  it('handles symbol-named methods without description (covers description fallback)', (): void => {
    // eslint-disable-next-line symbol-description -- testing
    const METHOD_SYM_NO_DESC: unique symbol = Symbol() // no description

    class SymFixtureNoDesc {
      public enabled = true

      public gate(name: string, args: readonly unknown[]): boolean {
        // When description is missing, String(symbol) -> "Symbol()"
        return name === 'Symbol()' && args.length === 1
      }

      @guardedBy<SymFixtureNoDesc>('gate')
      public [METHOD_SYM_NO_DESC](id: string): string {
        return `ok:${id}`
      }
    }

    const fx = new SymFixtureNoDesc()
    const gateSpy = rs.spyOn(fx, 'gate')

    const result = fx[METHOD_SYM_NO_DESC]('Q')
    expect(result).toBe('ok:Q')

    expect(gateSpy).toHaveBeenCalledTimes(1)
    expect(gateSpy).toHaveBeenCalledWith('Symbol()', ['Q'])
  })
})
