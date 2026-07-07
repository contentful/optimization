import { Component, computed, effect, inject, input } from '@angular/core'
import { ConsentCookie } from '../../services/consent'
import { NgLiveUpdates } from '../../services/live-updates'
import { NgContentfulOptimization } from '../../services/optimization'
import { fromSdkState } from '../../utils'

@Component({
  selector: 'app-control-panel',
  templateUrl: './index.html',
})
export class ControlPanel {
  readonly onTrackConversion = input<(() => void) | undefined>(undefined)

  private readonly optimization = inject(NgContentfulOptimization)
  private readonly consentCookie = inject(ConsentCookie)
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
  protected readonly booleanFlag = fromSdkState<unknown>(() =>
    this.optimization.runtime().states.flag('boolean'),
  )

  constructor() {
    // Mirror the SDK's internal consent state into an app-level cookie the SSR
    // server can read on the next request. Consent gathering is a consumer-app
    // concern; the SDK only consumes the resolved boolean.
    effect(() => {
      const value = this.consent()
      if (typeof value === 'boolean') this.consentCookie.write(value)
    })
  }

  protected toggleConsent(): void {
    this.optimization.runtime().consent(this.consent() !== true)
  }

  protected identify(): void {
    void this.optimization.runtime().identify({
      userId: 'charles',
      traits: { identified: true },
    })
  }

  protected reset(): void {
    const runtime = this.optimization.runtime()
    runtime.reset()
    void runtime.page()
  }

  protected trackConversion(): void {
    this.onTrackConversion()?.()
  }
}
