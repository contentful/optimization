import { Component, computed, effect, inject, input } from '@angular/core'
import { NgLiveUpdates } from '../../services/live-updates'
import { NgContentfulOptimization } from '../../services/optimization'
import { fromSdkState } from '../../utils'

const APP_PERSONALIZATION_CONSENT_COOKIE = 'app-personalization-consent'

/**
 * Mirror the SDK's internal consent state into a cookie the SSR server can
 * read on the next request. Without this, the server can't tell whether the
 * user has granted consent and falls back to baseline rendering. Matches the
 * pattern used by `nextjs-sdk_ssr/components/InteractiveControls.tsx`.
 */
function syncConsentCookie(consent: boolean): void {
  if (typeof document === 'undefined') return
  const value = consent ? 'granted' : 'denied'
  document.cookie = `${APP_PERSONALIZATION_CONSENT_COOKIE}=${value}; Path=/; SameSite=Lax`
}

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
    this.optimization.sdk?.states.flag('boolean'),
  )

  constructor() {
    effect(() => {
      const value = this.consent()
      if (typeof value === 'boolean') syncConsentCookie(value)
    })
  }

  protected toggleConsent(): void {
    this.optimization.sdk?.consent(this.consent() !== true)
  }

  protected identify(): void {
    void this.optimization.sdk?.identify({ userId: 'charles', traits: { identified: true } })
  }

  protected reset(): void {
    this.optimization.sdk?.reset()
    void this.optimization.sdk?.page()
  }

  protected trackConversion(): void {
    this.onTrackConversion()?.()
  }
}
