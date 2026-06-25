import { Component, computed, effect, inject, input } from '@angular/core'
import { writeConsentCookie } from '../../services/consent'
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
    this.optimization.ifBrowser((sdk) => sdk.states.flag('boolean')),
  )

  constructor() {
    // Mirror the SDK's internal consent state into an app-level cookie the SSR
    // server can read on the next request. Consent gathering is a consumer-app
    // concern; the SDK only consumes the resolved boolean.
    effect(() => {
      const value = this.consent()
      if (typeof value === 'boolean') writeConsentCookie(value)
    })
  }

  protected toggleConsent(): void {
    this.optimization.ifBrowser((sdk) => {
      sdk.consent(this.consent() !== true)
    })
  }

  protected identify(): void {
    this.optimization.ifBrowser((sdk) => {
      void sdk.identify({ userId: 'charles', traits: { identified: true } })
    })
  }

  protected reset(): void {
    this.optimization.ifBrowser((sdk) => {
      sdk.reset()
      void sdk.page()
    })
  }

  protected trackConversion(): void {
    this.onTrackConversion()?.()
  }
}
