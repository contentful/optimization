import { DestroyRef, inject, signal, type Signal } from '@angular/core'
import type { MergeTagEntry } from '@contentful/optimization-web/api-schemas'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isMergeTagEntry(entry: unknown): entry is MergeTagEntry {
  if (!isRecord(entry) || !isRecord(entry.sys)) return false
  if (!isRecord(entry.sys.contentType)) return false
  if (!isRecord(entry.sys.contentType.sys)) return false
  return entry.sys.contentType.sys.id === 'nt_mergetag'
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
