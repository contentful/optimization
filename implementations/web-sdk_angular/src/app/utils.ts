import { DestroyRef, effect, inject, signal, type Signal } from '@angular/core'

export interface SdkObservable<T> {
  subscribe: (fn: (v: T) => void) => { unsubscribe: () => void }
}

export function fromSdkState<T>(
  source: SdkObservable<T> | (() => SdkObservable<T> | undefined),
): Signal<T | undefined> {
  const s = signal<T | undefined>(undefined)
  const destroyRef = inject(DestroyRef)

  if (typeof source === 'function') {
    let sub: { unsubscribe: () => void } | undefined = undefined

    effect(() => {
      sub?.unsubscribe()
      sub = undefined
      s.set(undefined)
      const obs = source()
      if (obs)
        sub = obs.subscribe((v) => {
          s.set(v)
        })
    })

    destroyRef.onDestroy(() => sub?.unsubscribe())
  } else {
    const sub = source.subscribe((v) => {
      s.set(v)
    })
    destroyRef.onDestroy(() => {
      sub.unsubscribe()
    })
  }

  return s.asReadonly()
}
