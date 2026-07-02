import { signal } from '@preact/signals-core'
import { staticObservable, toObservable } from './Observable'

describe('staticObservable', () => {
  it('exposes the constant value as current', () => {
    expect(staticObservable('value').current).toBe('value')
    expect(staticObservable(undefined).current).toBeUndefined()
  })

  it('emits the value once on subscribe and never again', () => {
    const received: number[] = []
    const subscription = staticObservable(42).subscribe((value) => {
      received.push(value)
    })

    expect(received).toEqual([42])

    // No mechanism can change a static value, so the callback never fires again.
    subscription.unsubscribe()
    expect(received).toEqual([42])
  })

  it('emits non-nullish values through subscribeOnce and skips nullish ones', () => {
    const receivedValue: number[] = []
    staticObservable(7).subscribeOnce((value) => {
      receivedValue.push(value)
    })
    expect(receivedValue).toEqual([7])

    const receivedNullish: unknown[] = []
    staticObservable(undefined).subscribeOnce((value) => {
      receivedNullish.push(value)
    })
    expect(receivedNullish).toEqual([])
  })
})

describe('Observable helpers', () => {
  it('exposes current as a deep-cloned snapshot of the signal value', () => {
    const source = signal({ nested: { count: 1 } })
    const observable = toObservable(source)
    const current = observable.current

    current.nested.count = 999

    expect(current.nested.count).toBe(999)
    expect(source.value.nested.count).toBe(1)
  })

  it('updates current when the signal value changes', () => {
    const source = signal<{ nested: { count: number } } | undefined>({ nested: { count: 1 } })
    const observable = toObservable(source)

    expect(observable.current?.nested.count).toBe(1)

    source.value = { nested: { count: 2 } }

    expect(observable.current?.nested.count).toBe(2)
  })

  it('passes deep-cloned values to subscribe callbacks', () => {
    const source = signal({ nested: { count: 1 } })
    const receivedValues: Array<{ nested: { count: number } }> = []
    const subscription = toObservable(source).subscribe((value) => {
      value.nested.count = 999
      receivedValues.push(value)
    })

    expect(source.value.nested.count).toBe(1)

    source.value = { nested: { count: 2 } }

    expect(source.value.nested.count).toBe(2)
    expect(receivedValues.map((value) => value.nested.count)).toEqual([999, 999])

    subscription.unsubscribe()
  })

  it('emits values until explicitly unsubscribed', () => {
    const source = signal<number>(1)
    const values: number[] = []
    const subscription = toObservable(source).subscribe((value) => {
      values.push(value)
    })

    source.value = 2
    subscription.unsubscribe()
    source.value = 3

    expect(values).toEqual([1, 2])
  })

  it('emits only the first non-nullish value then unsubscribes automatically', () => {
    const source = signal<string | null | undefined>(undefined)
    const values: string[] = []
    const subscription = toObservable(source).subscribeOnce((value) => {
      values.push(value)
    })

    source.value = null
    source.value = undefined
    source.value = 'first'
    source.value = 'second'
    subscription.unsubscribe()

    expect(values).toEqual(['first'])
  })

  it('does not emit when manually unsubscribed before a non-nullish value', () => {
    const source = signal<string | undefined>(undefined)
    const values: string[] = []
    const subscription = toObservable(source).subscribeOnce((value) => {
      values.push(value)
    })

    subscription.unsubscribe()
    source.value = 'late'

    expect(values).toEqual([])
  })

  it('handles immediate non-nullish values as a one-shot subscription', () => {
    const source = signal<string | undefined>('ready')
    const values: string[] = []
    const subscription = toObservable(source).subscribeOnce((value) => {
      values.push(value)
    })

    source.value = 'later'
    subscription.unsubscribe()

    expect(values).toEqual(['ready'])
  })

  it('passes deep-cloned values to subscribeOnce callbacks', () => {
    const source = signal<{ nested: { count: number } } | undefined>({ nested: { count: 1 } })
    const values: Array<{ nested: { count: number } }> = []
    const subscription = toObservable(source).subscribeOnce((value) => {
      value.nested.count = 999
      values.push(value)
    })

    expect(source.value?.nested.count).toBe(1)
    expect(values.map((value) => value.nested.count)).toEqual([999])

    subscription.unsubscribe()
  })
})
