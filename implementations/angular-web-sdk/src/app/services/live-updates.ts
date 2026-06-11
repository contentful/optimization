import { inject, Injectable } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { NgContentfulOptimization } from '@contentful/optimization-angular'
import { BehaviorSubject, combineLatest, map, Observable, of } from 'rxjs'
import { isRecord } from '../utils'

interface SdkBoolObservable {
  subscribe: (fn: (v: unknown) => void) => { unsubscribe: () => void }
}

function isSdkBoolObservable(obs: unknown): obs is SdkBoolObservable {
  return isRecord(obs) && typeof obs.subscribe === 'function'
}

function sdkBoolObs(sdk: NgContentfulOptimization['sdk'], key: string): Observable<boolean> {
  const states: unknown = sdk.states
  if (!isRecord(states)) return of(false)
  const obs: unknown = states[key]
  if (!isSdkBoolObservable(obs)) return of(false)
  return new Observable<boolean>((subscriber) => {
    const sub = obs.subscribe((v) => {
      subscriber.next(v === true)
    })
    return () => {
      sub.unsubscribe()
    }
  })
}

@Injectable({ providedIn: 'root' })
export class NgContentfulLiveUpdates {
  private readonly subject = new BehaviorSubject<boolean>(false)

  readonly globalLiveUpdates = toSignal(this.subject, { initialValue: false })

  readonly previewPanelVisible = toSignal(
    combineLatest([
      sdkBoolObs(inject(NgContentfulOptimization).sdk, 'previewPanelAttached'),
      sdkBoolObs(inject(NgContentfulOptimization).sdk, 'previewPanelOpen'),
    ]).pipe(map(([attached, open]) => attached && open)),
    { initialValue: false },
  )

  toggle(): void {
    this.subject.next(!this.subject.value)
  }
}
