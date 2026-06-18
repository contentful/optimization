import { Component, computed, inject, input } from '@angular/core'
import { NgLiveUpdates } from '../../services/live-updates'
import { NgContentfulOptimization } from '../../services/optimization'
import { fromSdkConditionalState } from '../../utils'

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
  // Consent-gated flag: sdk.states.flag() returns a new observable instance on every call,
  // so the factory must be re-invoked on each consent change rather than holding a reference —
  // a stale reference from a previous consent session would miss updates or emit after revoke.
  // fromSdkConditionalState re-runs the factory reactively: subscribes on grant, unsubscribes
  // and resets to undefined on revoke. flag-view-tracking.spec.ts covers both cases.
  protected readonly booleanFlag = fromSdkConditionalState(() =>
    this.consent() === true ? this.optimization.sdk.states.flag('boolean') : undefined,
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
