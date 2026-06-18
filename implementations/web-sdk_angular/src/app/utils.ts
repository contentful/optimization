import { DestroyRef, effect, inject, signal, type Signal } from '@angular/core'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export interface SdkObservable<T> {
  subscribe: (fn: (v: T) => void) => { unsubscribe: () => void }
}

export function fromSdkState<T>(obs: SdkObservable<T>): Signal<T | undefined> {
  const s = signal<T | undefined>(undefined)
  const destroyRef = inject(DestroyRef)
  const sub = obs.subscribe((v) => {
    s.set(v)
  })
  destroyRef.onDestroy(() => {
    sub.unsubscribe()
  })
  return s.asReadonly()
}

export function fromSdkConditionalState<T>(
  factory: () => SdkObservable<T> | undefined,
): Signal<T | undefined> {
  const s = signal<T | undefined>(undefined)
  const destroyRef = inject(DestroyRef)
  let sub: { unsubscribe: () => void } | undefined = undefined

  effect(() => {
    sub?.unsubscribe()
    sub = undefined
    s.set(undefined)
    const obs = factory()
    if (obs)
      sub = obs.subscribe((v) => {
        s.set(v)
      })
  })

  destroyRef.onDestroy(() => sub?.unsubscribe())
  return s.asReadonly()
}
