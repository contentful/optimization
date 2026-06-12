import { Component, computed, inject, input } from '@angular/core'
import { NgContentfulLiveUpdates } from '../../services/live-updates'
import { NgContentfulOptimization } from '../../services/optimization'
import { fromSdkState } from '../../utils'

@Component({
  selector: 'app-control-panel',
  templateUrl: './index.html',
})
export class ControlPanel {
  // inputs
  readonly onTrackConversion = input<(() => void) | undefined>(undefined)

  // injected dependencies
  private readonly optimization = inject(NgContentfulOptimization)
  protected readonly liveUpdatesService = inject(NgContentfulLiveUpdates)

  // protected state
  protected readonly consent = this.optimization.consent
  protected readonly isIdentified = computed(() =>
    Boolean(this.optimization.profile()?.traits.identified),
  )
  protected readonly optimizationCount = computed(
    () => this.optimization.selectedOptimizations()?.length ?? 0,
  )
  protected readonly booleanFlag = fromSdkState<unknown>(
    this.optimization.sdk.states.flag('boolean'),
  )

  // public methods
  protected toggleConsent(): void {
    this.optimization.sdk.consent(this.consent() !== true)
  }

  protected identify(): void {
    void this.optimization.sdk.identify({ userId: 'charles', traits: { identified: true } })
  }

  protected reset(): void {
    this.optimization.sdk.reset()
    void this.optimization.sdk.page()
  }

  protected trackConversion(): void {
    this.onTrackConversion()?.()
  }
}
