import { computed, inject, Injectable, signal } from '@angular/core'
import { fromSdkState } from '../utils'
import { NgContentfulOptimization } from './optimization'

function clickPreviewPanelToggle(): void {
  if (typeof document === 'undefined') return
  const panel = document.querySelector('ctfl-opt-preview-panel')
  const btn = panel?.shadowRoot?.querySelector<HTMLButtonElement>('button.toggle-drawer')
  btn?.click()
}

@Injectable({ providedIn: 'root' })
export class NgLiveUpdates {
  private readonly optimization = inject(NgContentfulOptimization)

  private readonly globalLiveUpdatesSignal = signal(false)
  private readonly previewPanelAttached = fromSdkState<boolean>(
    () => this.optimization.runtime().states.previewPanelAttached,
  )
  private readonly previewPanelOpen = fromSdkState<boolean>(
    () => this.optimization.runtime().states.previewPanelOpen,
  )

  readonly globalLiveUpdates = this.globalLiveUpdatesSignal.asReadonly()
  readonly previewPanelVisible = computed(
    () => (this.previewPanelAttached() ?? false) && (this.previewPanelOpen() ?? false),
  )

  toggle(): void {
    this.globalLiveUpdatesSignal.update((v) => !v)
  }

  readonly togglePreviewPanel = clickPreviewPanelToggle
}
