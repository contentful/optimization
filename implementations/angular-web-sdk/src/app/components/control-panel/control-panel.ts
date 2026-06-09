import { Component, computed, inject, input } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { NgContentfulLiveUpdates, NgContentfulOptimization } from '@contentful/optimization-angular'
import { map } from 'rxjs/operators'

@Component({
  selector: 'app-control-panel',
  templateUrl: './control-panel.html',
})
export class ControlPanel {
  // inputs
  readonly onTrackConversion = input<(() => void) | undefined>(undefined)

  // injected dependencies
  private readonly optimization = inject(NgContentfulOptimization)
  protected readonly liveUpdatesService = inject(NgContentfulLiveUpdates)

  // protected state
  protected readonly consent = toSignal(this.optimization.consent$)
  protected readonly isIdentified = computed(() =>
    Boolean(this.optimization.profile()?.traits.identified),
  )
  protected readonly optimizationCount = toSignal(
    this.optimization.selectedOptimizations$.pipe(map((s) => s?.length ?? 0)),
    { initialValue: 0 },
  )
  protected readonly booleanFlag = toSignal(this.optimization.booleanFlag$)

  // public methods
  protected toggleConsent(): void {
    this.optimization.setConsent(this.consent() !== true)
  }

  protected identify(): void {
    this.optimization.identify('charles', { identified: true })
  }

  protected reset(): void {
    this.optimization.reset()
  }
}
