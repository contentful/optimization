import { computed, inject, Injectable, signal } from '@angular/core'
import { fromSdkState, NgContentfulOptimization } from '@contentful/optimization-angular'

@Injectable({ providedIn: 'root' })
export class NgContentfulLiveUpdates {
  private readonly globalLiveUpdatesSignal = signal(false)

  readonly globalLiveUpdates = this.globalLiveUpdatesSignal.asReadonly()

  private readonly sdk = inject(NgContentfulOptimization).sdk

  private readonly previewPanelAttached = fromSdkState<boolean>(
    this.sdk.states.previewPanelAttached,
  )
  private readonly previewPanelOpen = fromSdkState<boolean>(this.sdk.states.previewPanelOpen)

  readonly previewPanelVisible = computed(
    () => (this.previewPanelAttached() ?? false) && (this.previewPanelOpen() ?? false),
  )

  toggle(): void {
    this.globalLiveUpdatesSignal.update((v) => !v)
  }
}
