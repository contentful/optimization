import { inject, Injectable } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs'
import { NG_CONTENTFUL_OPTIMIZATION_CONFIG } from '../config'
import { isRecord } from '../utils'
import { NgContentfulOptimization } from './optimization'

function getPreviewPanelToggleButton(
  tag: string,
  toggleSelector: string,
): HTMLButtonElement | null {
  const panel = document.querySelector(tag)
  if (!(panel instanceof HTMLElement)) return null
  const btn = panel.shadowRoot?.querySelector(toggleSelector)
  return btn instanceof HTMLButtonElement ? btn : null
}

interface SdkBoolObservable {
  subscribe: (fn: (v: unknown) => void) => { unsubscribe: () => void }
}

function isSdkBoolObservable(obs: unknown): obs is SdkBoolObservable {
  return isRecord(obs) && typeof obs.subscribe === 'function'
}

function sdkBoolObs(sdk: NgContentfulOptimization['sdk'], key: string): Observable<boolean> {
  const states: unknown = sdk.states
  if (!isRecord(states))
    return new Observable<boolean>((sub) => {
      sub.next(false)
    })
  const obs: unknown = states[key]
  if (!isSdkBoolObservable(obs))
    return new Observable<boolean>((sub) => {
      sub.next(false)
    })
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
  private readonly config = inject(NG_CONTENTFUL_OPTIMIZATION_CONFIG)

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

  togglePreviewPanel(): void {
    const tag = this.config.previewPanel?.tag ?? 'ctfl-opt-preview-panel'
    const toggleSelector = this.config.previewPanel?.toggleSelector ?? 'button.toggle-drawer'
    getPreviewPanelToggleButton(tag, toggleSelector)?.click()
  }
}
