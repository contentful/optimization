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
  // states.flag() emits on value changes only, not on consent changes. A direct subscription
  // fires the initial emission before consent is held; trackFlagView is blocked, the value
  // stays stable, and no event is ever recorded after consent is granted. Passing a thunk
  // makes fromSdkState re-subscribe reactively: on consent grant a fresh subscription emits
  // the current value while consent is held; on revoke the subscription is dropped and the
  // signal resets to undefined.
  // Ideally the core SDK would make states.flag() consent-aware so a direct observable could
  // be passed here — see flag-view-tracking.spec.ts for the cases this gate must satisfy.
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
