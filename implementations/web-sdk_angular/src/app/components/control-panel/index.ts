import { Component, computed, inject, input } from '@angular/core'
import { NgLiveUpdates } from '../../services/live-updates'
import { NgContentfulOptimization } from '../../services/optimization'
import { fromSdkState } from '../../utils'

@Component({
  selector: 'app-control-panel',
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class ControlPanel {
  readonly onTrackConversion = input<(() => void) | undefined>(undefined)

  private readonly optimization = inject(NgContentfulOptimization)
  protected readonly liveUpdatesService = inject(NgLiveUpdates)

  protected readonly consent = this.optimization.consent
  protected readonly isIdentified = computed(() =>
    Boolean(this.optimization.profile()?.traits.identified),
  )
  protected readonly optimizationCount = computed(
    () => this.optimization.selectedOptimizations()?.length ?? 0,
  )
  // This is an active exposure stream. Core does not mark one-off flag reads as
  // tracked until a flag-view event is actually accepted.
  protected readonly booleanFlag = fromSdkState<unknown>(
    this.optimization.sdk.states.flag('boolean'),
  )

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
