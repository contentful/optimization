import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core'
import { NgLiveUpdates } from '../../services/live-updates'
import { NgContentfulOptimization } from '../../services/optimization'
import { fromSdkState, isRecord } from '../../utils'

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
  protected readonly booleanFlag = signal<unknown>(undefined)

  private readonly rawProfile = fromSdkState<unknown>(this.optimization.sdk.states.profile)

  constructor() {
    const destroyRef = inject(DestroyRef)
    let flagSub: { unsubscribe: () => void } | undefined = undefined
    let trackedProfileId: string | undefined = undefined

    effect(() => {
      const raw = this.rawProfile()
      const profileId = isRecord(raw) && typeof raw.id === 'string' ? raw.id : undefined
      if (this.consent() === true && profileId !== undefined) {
        if (profileId !== trackedProfileId) {
          flagSub?.unsubscribe()
          trackedProfileId = profileId
          flagSub = this.optimization.sdk.states.flag('boolean').subscribe((v) => {
            this.booleanFlag.set(v)
          })
        }
      } else {
        flagSub?.unsubscribe()
        flagSub = undefined
        trackedProfileId = undefined
        this.booleanFlag.set(undefined)
      }
    })

    destroyRef.onDestroy(() => {
      flagSub?.unsubscribe()
    })
  }

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
