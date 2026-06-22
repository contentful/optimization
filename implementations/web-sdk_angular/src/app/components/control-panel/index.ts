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
  // The flag value is always correct for display regardless of consent — even a direct
  // fromSdkState subscription would show the right value. The consent gate is purely about
  // tracking: states.flag().subscribe() bundles value delivery and trackFlagView in the same
  // callback. If the subscription opens before consent, the initial emission is blocked by
  // hasConsent(); the value then stays stable so the observable never re-fires and
  // trackFlagView is never retried — the flag view event is silently lost even after consent
  // is granted. Passing a thunk re-triggers the subscription on consent change: on grant a
  // fresh subscription opens and immediately emits the current value while consent is held,
  // so trackFlagView succeeds; on revoke the subscription is dropped.
  // Ideally the core SDK would decouple these: deliver the value unconditionally, fire
  // trackFlagView internally on consent change — see flag-view-tracking.spec.ts.
  protected readonly booleanFlag = fromSdkState(() =>
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
