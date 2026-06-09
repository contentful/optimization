import { Component, computed, inject, input } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import type { SelectedOptimizationArray } from '@contentful/optimization-web/api-schemas'
import { Observable } from 'rxjs'
import { LiveUpdates } from '../../optimization/live-updates'
import { fromSdkObservable, Optimization } from '../../optimization/optimization'

@Component({
  selector: 'app-control-panel',
  templateUrl: './control-panel.html',
})
export class ControlPanel {
  readonly onTrackConversion = input<(() => void) | undefined>(undefined)

  private readonly optimization = inject(Optimization)
  protected readonly liveUpdatesService = inject(LiveUpdates)

  protected readonly consent = toSignal(this.optimization.consent$)
  protected readonly profile = toSignal(this.optimization.profile$)

  protected readonly isIdentified = computed(() => {
    const p = this.profile()
    if (p === null || typeof p !== 'object') return false
    if (!('traits' in p)) return false
    const { traits } = p as { traits: unknown }
    if (traits === null || typeof traits !== 'object') return false
    if (!('identified' in traits)) return false
    return Boolean((traits as { identified: unknown }).identified)
  })

  protected readonly selectedOptimizationCount = toSignal(
    this.optimization.sdk !== undefined
      ? fromSdkObservable<SelectedOptimizationArray | undefined>(
          this.optimization.sdk.states.selectedOptimizations,
        )
      : new Observable<SelectedOptimizationArray | undefined>((sub) => {
          sub.next(undefined)
        }),
    { initialValue: undefined },
  )

  protected readonly optimizationCount = computed(
    () => this.selectedOptimizationCount()?.length ?? 0,
  )

  protected toggleConsent(): void {
    this.optimization.setConsent(this.consent() !== true)
  }

  protected identify(): void {
    this.optimization.identify()
  }

  protected reset(): void {
    this.optimization.reset()
  }

  protected toggleGlobalLiveUpdates(): void {
    this.liveUpdatesService.toggle()
  }
}
