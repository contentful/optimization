import { inject, Injectable } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs'
import { NgContentfulOptimization } from './optimization'
import { isRecord } from './utils'

const PREVIEW_PANEL_TAG = 'ctfl-opt-preview-panel'
const PREVIEW_PANEL_TOGGLE_SELECTOR = 'button.toggle-drawer'

function getPreviewPanelToggleButton(): HTMLButtonElement | null {
  const panel = document.querySelector(PREVIEW_PANEL_TAG)
  if (!(panel instanceof HTMLElement)) return null
  const btn = panel.shadowRoot?.querySelector(PREVIEW_PANEL_TOGGLE_SELECTOR)
  return btn instanceof HTMLButtonElement ? btn : null
}

export function togglePreviewPanel(): void {
  getPreviewPanelToggleButton()?.click()
}

interface SdkBoolObservable {
  subscribe: (fn: (v: unknown) => void) => { unsubscribe: () => void }
}

function isSdkBoolObservable(obs: unknown): obs is SdkBoolObservable {
  return isRecord(obs) && typeof obs.subscribe === 'function'
}

function sdkBoolObs(sdk: NgContentfulOptimization['sdk'], key: string): Observable<boolean> {
  const fallback = new Observable<boolean>((sub) => {
    sub.next(false)
  })
  if (sdk === undefined) return fallback
  const states: unknown = sdk.states
  if (!isRecord(states)) return fallback
  const obs: unknown = states[key]
  if (!isSdkBoolObservable(obs)) return fallback
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
  readonly globalNgContentfulLiveUpdates$ = this.subject.asObservable()
  readonly globalNgContentfulLiveUpdates = toSignal(this.subject, { initialValue: false })

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
